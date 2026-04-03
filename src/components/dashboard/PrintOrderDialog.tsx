'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { printKitchenTicket } from '@/lib/printTicket';
import type { Order, PrinterConfig } from '@/types';

// ─── Inner content — keyed by order.id so state resets per order ──────────────

interface InnerProps {
  order: Order;
  restaurantId: string;
  restaurantName: string;
  mode: 'accept' | 'reprint';
  onConfirm: (order: Order) => void;
  onClose: () => void;
  printerConfig?: PrinterConfig | null;
}

function PrintDialogInner({
  order,
  restaurantId,
  restaurantName,
  mode,
  onConfirm,
  onClose,
  printerConfig,
}: InnerProps) {
  const items = order.items ?? [];

  // Unique category names present in this order, in first-seen order
  const categoriesInOrder = Array.from(
    new Set(items.map((i) => i.category_name ?? 'Uncategorized')),
  );

  const [selected, setSelected]   = useState<string[]>(categoriesInOrder);
  const [printing, setPrinting]   = useState(false);
  // Cache the KOT number so multiple station prints from the same dialog
  // session share the same KOT number.
  const [cachedKot, setCachedKot] = useState<number | null>(null);

  function toggleCategory(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function getKotNumber(): Promise<number> {
    if (cachedKot !== null) return cachedKot;
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc('get_next_kot_number', {
        p_restaurant_id: restaurantId,
      });
      const num = (data as number) ?? 1;
      setCachedKot(num);
      return num;
    } catch {
      return 1;
    }
  }

  async function handlePrint(selectedCategories: string[]) {
    if (printing) return;
    setPrinting(true);
    try {
      const kot = await getKotNumber();

      if (printerConfig && printerConfig.printers.length > 0) {
        const { printerService } = await import('@/lib/printer-service');
        const { buildKOTTicket } = await import('@/lib/escpos-kot');
        const copies = printerConfig.copies_kot ?? 1;

        if (printerConfig.kot_printer_mode !== 'station_routing') {
          // ── Single-printer mode: one combined ticket ────────────────────────
          const pid = printerConfig.kot_printer_mode;
          const printer = printerConfig.printers.find((p) => p.id === pid) ?? printerConfig.printers[0];
          if (printer.type === 'browser') {
            printKitchenTicket(order, kot, restaurantName, selectedCategories);
          } else {
            const data = buildKOTTicket(order, restaurantName, kot, selectedCategories, printer.paper_width);
            for (let i = 0; i < copies; i++) {
              const result = await printerService.print(printer, data);
              if (!result.success) toast.error(`${printer.name}: ${result.error ?? 'Print failed'}`);
            }
          }
        } else {
          // ── Station routing: group categories by printer, one ticket per printer
          const routingMap = printerConfig.station_routing ?? {};
          const defaultPrinterId = printerConfig.printers[0].id;
          const printerGroups = new Map<string, string[]>(); // printerId → categoryNames[]

          for (const cat of selectedCategories) {
            const pid = routingMap[cat] || defaultPrinterId;
            if (!printerGroups.has(pid)) printerGroups.set(pid, []);
            printerGroups.get(pid)!.push(cat);
          }

          const totalCatsInOrder = categoriesInOrder.length;
          await Promise.all(
            Array.from(printerGroups.entries()).map(async ([pid, cats]) => {
              const printer = printerConfig.printers.find((p) => p.id === pid);
              if (!printer) return;
              if (printer.type === 'browser') {
                printKitchenTicket(order, kot, restaurantName, cats);
                return;
              }
              const data = buildKOTTicket(order, restaurantName, kot, cats, printer.paper_width, totalCatsInOrder);
              for (let i = 0; i < copies; i++) {
                const result = await printerService.print(printer, data);
                if (!result.success) toast.error(`${printer.name}: ${result.error ?? 'Print failed'}`);
              }
            })
          );
        }
      } else {
        // No printer configured — browser fallback
        printKitchenTicket(order, kot, restaurantName, selectedCategories);
      }

      onConfirm(order);
    } finally {
      setPrinting(false);
    }
  }

  const itemCountFor = (cat: string) =>
    items.filter((i) => (i.category_name ?? 'Uncategorized') === cat).length;

  // "Print Selected" is only meaningfully different when a proper subset is checked
  const isSubset = selected.length > 0 && selected.length < categoriesInOrder.length;

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Print Kitchen Ticket
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3 py-1">
        <p className="text-sm text-muted-foreground">
          Order{' '}
          <span className="font-semibold text-foreground">#{order.order_number}</span>
          {' '}— select stations to print:
        </p>

        {categoriesInOrder.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items in this order.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {categoriesInOrder.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none hover:bg-muted/40 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="h-4 w-4 rounded border-gray-300 accent-black"
                />
                <span className="text-sm font-medium flex-1">{cat}</span>
                <span className="text-xs text-muted-foreground">
                  {itemCountFor(cat)} {itemCountFor(cat) === 1 ? 'item' : 'items'}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button
            onClick={() => handlePrint(categoriesInOrder)}
            disabled={printing || categoriesInOrder.length === 0}
            className="flex-1"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            {printing ? 'Printing…' : 'Print All'}
          </Button>

          {/* Only shown when user has deselected at least one category */}
          <Button
            onClick={() => handlePrint(selected)}
            disabled={printing || !isSubset}
            variant="outline"
            className="flex-1"
          >
            Print Selected
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
          disabled={printing}
          onClick={() => {
            if (mode === 'accept') onConfirm(order);
            else onClose();
          }}
        >
          {mode === 'accept' ? 'Skip Print & Accept' : 'Close'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  order: Order | null;
  restaurantId: string;
  restaurantName: string;
  /** 'accept' = print then advance status; 'reprint' = print only */
  mode: 'accept' | 'reprint';
  onConfirm: (order: Order) => void;
  onClose: () => void;
  printerConfig?: PrinterConfig | null;
}

export default function PrintOrderDialog(props: Props) {
  const { order, onClose } = props;

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* key={order.id} ensures checkboxes + cached KOT reset for each new order */}
      {order && <PrintDialogInner key={order.id} {...props} order={order} />}
    </Dialog>
  );
}
