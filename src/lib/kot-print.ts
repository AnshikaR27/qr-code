/**
 * Shared KOT print logic used by both AutoPrintListener (on_order mode)
 * and GlobalNotifications acceptOrder (on_accept mode).
 *
 * Does NOT change order status — caller is responsible for that.
 */

import { createClient } from '@/lib/supabase/client';
import type { Order, PrinterConfig } from '@/types';

export async function printKOT(
  order: Order,
  restaurantId: string,
  restaurantName: string,
  printerConfig: PrinterConfig | null,
): Promise<void> {
  const items = order.items ?? [];
  const categoriesInOrder = Array.from(
    new Set(items.map((i) => i.category_name ?? 'Uncategorized')),
  );

  // Fetch KOT number (sequential within today)
  let kot = 1;
  try {
    const supabase = createClient();
    const { data } = await supabase.rpc('get_next_kot_number', { p_restaurant_id: restaurantId });
    kot = (data as number) ?? 1;
  } catch { /* fallback to 1 */ }

  if (printerConfig && printerConfig.printers.length > 0) {
    const { printerService } = await import('@/lib/printer-service');
    const { buildKOTTicket } = await import('@/lib/escpos-kot');
    const copies = printerConfig.copies_kot ?? 1;

    if (printerConfig.kot_printer_mode !== 'station_routing') {
      const pid = printerConfig.kot_printer_mode;
      const printer =
        printerConfig.printers.find((p) => p.id === pid) ?? printerConfig.printers[0];
      if (printer.type === 'browser') {
        const { printKitchenTicket } = await import('@/lib/printTicket');
        printKitchenTicket(order, kot, restaurantName, categoriesInOrder);
      } else {
        const data = buildKOTTicket(order, restaurantName, kot, categoriesInOrder, printer.paper_width);
        for (let i = 0; i < copies; i++) await printerService.print(printer, data);
      }
    } else {
      const routingMap = printerConfig.station_routing ?? {};
      const defaultPrinterId = printerConfig.printers[0].id;
      const printerGroups = new Map<string, string[]>();
      for (const cat of categoriesInOrder) {
        const pid = routingMap[cat] || defaultPrinterId;
        if (!printerGroups.has(pid)) printerGroups.set(pid, []);
        printerGroups.get(pid)!.push(cat);
      }
      await Promise.all(
        Array.from(printerGroups.entries()).map(async ([pid, cats]) => {
          const printer = printerConfig.printers.find((p) => p.id === pid);
          if (!printer) return;
          if (printer.type === 'browser') {
            const { printKitchenTicket } = await import('@/lib/printTicket');
            printKitchenTicket(order, kot, restaurantName, cats);
            return;
          }
          const data = buildKOTTicket(
            order,
            restaurantName,
            kot,
            cats,
            printer.paper_width,
            categoriesInOrder.length,
          );
          for (let i = 0; i < copies; i++) await printerService.print(printer, data);
        }),
      );
    }
  } else {
    // No printer config — fall back to browser print
    const { printKitchenTicket } = await import('@/lib/printTicket');
    printKitchenTicket(order, kot, restaurantName, categoriesInOrder);
  }
}
