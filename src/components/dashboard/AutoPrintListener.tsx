'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Order, PrinterConfig } from '@/types';

interface Props {
  restaurantId: string;
  restaurantName: string;
  printerConfig: PrinterConfig | null;
}

/**
 * Invisible component that lives in the dashboard LAYOUT so it persists across
 * all dashboard tab navigations. Handles two concerns that must never unmount:
 *
 *  1. USB/Serial printer reconnect on layout mount (so printers are ready
 *     before any print attempt, regardless of which page the user lands on).
 *
 *  2. Supabase Realtime subscription for auto-printing KOT tickets the moment
 *     a new order arrives (kot_print_trigger === 'on_order'). Previously this
 *     lived in KitchenDashboard and would stop listening when the user
 *     navigated away.
 */
export function AutoPrintListener({ restaurantId, restaurantName, printerConfig }: Props) {
  // Always-current refs so async callbacks never close over stale props
  const printerConfigRef = useRef(printerConfig);
  printerConfigRef.current = printerConfig;

  const restaurantNameRef = useRef(restaurantName);
  restaurantNameRef.current = restaurantName;

  // ── Reconnect USB/Serial printers on layout mount ───────────────────────────
  useEffect(() => {
    const config = printerConfig;
    if (!config) return;
    const connectable = config.printers.filter((p) => p.type === 'usb' || p.type === 'serial');
    if (connectable.length === 0) return;

    import('@/lib/printer-service').then(async ({ printerService }) => {
      const results = await printerService.reconnectAll(config);
      results.forEach((connected, printerId) => {
        console.log(`[AutoPrint] Printer ${printerId}: ${connected ? 'connected' : 'disconnected'}`);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global auto-print subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;

    const supabase = createClient();
    const isFirstRender = { current: true };

    const channel = supabase
      .channel(`auto-print-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          if (isFirstRender.current) return;

          const config = printerConfigRef.current;
          // Only fire for 'on_order' trigger — 'on_accept' is handled by the
          // print dialog inside KitchenDashboard when staff taps the button.
          if (config?.kot_print_trigger !== 'on_order') return;

          const { data } = await supabase
            .from('orders')
            .select('*, items:order_items(*), table:tables(*)')
            .eq('id', payload.new.id)
            .single();

          if (!data) return;
          const order = data as Order;

          console.log(`[AutoPrint] New order #${order.order_number}, printing KOT`);
          await autoPrintKOT(
            order,
            restaurantId,
            restaurantNameRef.current,
            printerConfigRef.current,
          );
        },
      )
      .subscribe((status) => {
        console.log('[AutoPrint] Subscription status:', status);
      });

    isFirstRender.current = false;

    return () => {
      console.log('[AutoPrint] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // This component renders nothing — it is a side-effect-only listener.
  return null;
}

// ── Auto-print logic (extracted from KitchenDashboard) ───────────────────────

async function autoPrintKOT(
  order: Order,
  restaurantId: string,
  restaurantName: string,
  printerConfig: PrinterConfig | null,
) {
  const items = order.items ?? [];
  const categoriesInOrder = Array.from(
    new Set(items.map((i) => i.category_name ?? 'Uncategorized')),
  );

  // Advance to 'preparing' regardless of print outcome
  try {
    const supabase = createClient();
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id);
  } catch (err) {
    console.error('[AutoPrint] Failed to advance order status:', err);
  }

  // Fetch KOT number
  let kot = 1;
  try {
    const supabase = createClient();
    const { data } = await supabase.rpc('get_next_kot_number', { p_restaurant_id: restaurantId });
    kot = (data as number) ?? 1;
  } catch { /* fallback to 1 */ }

  try {
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
          const data = buildKOTTicket(
            order,
            restaurantName,
            kot,
            categoriesInOrder,
            printer.paper_width,
          );
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
      const { printKitchenTicket } = await import('@/lib/printTicket');
      printKitchenTicket(order, kot, restaurantName, categoriesInOrder);
    }

    toast.success(`KOT printed — Order #${order.order_number}`);
  } catch (err) {
    toast.error(`Auto-print failed for #${order.order_number} — use reprint button`);
    console.error('[AutoPrint]', err);
  }
}
