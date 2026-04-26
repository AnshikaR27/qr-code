'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { playNewOrder, playOrderAlert, unlockAudio } from '@/lib/sounds';
import { printKOT } from '@/lib/kot-print';
import type { Order, PrinterConfig, BillingConfig } from '@/types';
import type { BillOrderData } from '@/lib/escpos-bill';

interface Props {
  restaurantId: string;
  restaurantName: string;
  restaurantPhone?: string | null;
  printerConfig: PrinterConfig | null;
  billingConfig?: BillingConfig | null;
}

/**
 * Invisible component that lives in the dashboard LAYOUT so it persists across
 * all dashboard tab navigations. Handles three concerns that must never unmount:
 *
 *  1. USB/Serial printer reconnect on layout mount (so printers are ready
 *     before any print attempt, regardless of which page the user lands on).
 *
 *  2. Supabase Realtime subscription for auto-printing KOT tickets the moment
 *     a new order arrives (kot_print_trigger === 'on_order'). Previously this
 *     lived in KitchenDashboard and would stop listening when the user
 *     navigated away.
 *
 *  3. Supabase Realtime Broadcast listener for bill-print events (Model C).
 *     Any device can request a bill print; this listener attempts to print
 *     on the locally-paired bill printer.
 */
export function AutoPrintListener({ restaurantId, restaurantName, restaurantPhone, printerConfig, billingConfig }: Props) {
  // Always-current refs so async callbacks never close over stale props
  const printerConfigRef = useRef(printerConfig);
  printerConfigRef.current = printerConfig;

  const restaurantNameRef = useRef(restaurantName);
  restaurantNameRef.current = restaurantName;

  const restaurantPhoneRef = useRef(restaurantPhone);
  restaurantPhoneRef.current = restaurantPhone;

  const billingConfigRef = useRef(billingConfig);
  billingConfigRef.current = billingConfig;

  // ── Unlock audio on first user interaction ─────────────────────────────────
  // Web Audio API requires a user gesture before AudioContext can run.
  // This ensures the chime works from the very first order after any click.
  useEffect(() => {
    function handleFirstClick() {
      unlockAudio().catch(() => {});
      document.removeEventListener('click', handleFirstClick, true);
    }
    document.addEventListener('click', handleFirstClick, true);
    return () => document.removeEventListener('click', handleFirstClick, true);
  }, []);

  // ── Reconnect USB/Serial printers on layout mount ───────────────────────────
  useEffect(() => {
    const config = printerConfig;
    if (!config) return;
    const connectable = config.printers.filter((p) => p.type === 'usb' || p.type === 'serial');
    if (connectable.length === 0) return;

    import('@/lib/printer-service').then(async ({ printerService }) => {
      const results = await printerService.reconnectAll(config);
      void results;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global auto-print KOT subscription ─────────────────────────────────────
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
          const isAutoMode = config?.kot_print_trigger === 'on_order';

          if (isAutoMode) {
            playOrderAlert(); // 3-second ding-dong pattern
          } else {
            // Single chime in manual mode — GlobalNotifications loops the rest
            playNewOrder();
          }

          // Auto-print only fires for 'on_order' trigger.
          // 'on_accept' printing is handled by GlobalNotifications acceptOrder.
          if (!isAutoMode) return;

          const { data } = await supabase
            .from('orders')
            .select('*, items:order_items(*), table:tables(*)')
            .eq('id', payload.new.id)
            .single();

          if (!data) return;
          const order = data as Order;

          await autoPrintKOT(
            order,
            restaurantId,
            restaurantNameRef.current,
            printerConfigRef.current,
          );
        },
      )
      .subscribe((status) => {
        console.log('[AutoPrint] KOT subscription status:', status);
      });

    isFirstRender.current = false;

    return () => {
      console.log('[AutoPrint] Cleaning up KOT subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // ── Bill-print broadcast listener (Model C) ───────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`bill-print-${restaurantId}`)
      .on('broadcast', { event: 'print-bill' }, async ({ payload }) => {
        console.log('[AutoPrint] ── broadcast received: print-bill ──');
        const config = printerConfigRef.current;
        const billing = billingConfigRef.current;
        console.log('[AutoPrint] bill_printer:', config?.bill_printer ?? '(not set)');
        console.log('[AutoPrint] billingConfig present:', !!billing);
        if (!config?.bill_printer || !billing) {
          console.log('[AutoPrint] SKIPPED — missing bill_printer or billingConfig');
          return;
        }

        const printer = config.printers.find((p) => p.id === config.bill_printer);
        console.log('[AutoPrint] printer resolved:', printer ? `${printer.name} (${printer.type})` : '(null)');
        if (!printer || printer.type === 'browser') {
          console.log('[AutoPrint] SKIPPED — no printer or browser type');
          return;
        }

        try {
          const { buildBillReceipt } = await import('@/lib/escpos-bill');
          const { printerService } = await import('@/lib/printer-service');

          const orderData = payload as BillOrderData & { order_id: string; order_number: number };
          console.log('[AutoPrint] order_number:', orderData.order_number, '| items:', orderData.items?.length ?? 0);
          const copies = config.copies_bill ?? 1;
          const dedupeKey = `bill:${orderData.order_id}`;

          console.log('[AutoPrint] USB connected for bill printer:', printerService.isUSBConnected(printer.id));

          const data = buildBillReceipt(
            orderData,
            restaurantNameRef.current,
            restaurantPhoneRef.current ?? null,
            billing,
            printer.paper_width,
            false,
          );
          console.log('[AutoPrint] receipt built, bytes:', data.length);

          const result = await printerService.print(printer, data, dedupeKey);
          console.log('[AutoPrint] print result:', JSON.stringify(result));
          if (result.success) {
            if (copies === 2) {
              const dup = buildBillReceipt(
                orderData,
                restaurantNameRef.current,
                restaurantPhoneRef.current ?? null,
                billing,
                printer.paper_width,
                true,
              );
              await printerService.print(printer, dup);
            }
            toast.success(`Bill #${orderData.order_number} printed`);
          } else {
            console.error('[AutoPrint] print FAILED:', result.error);
          }
        } catch (err) {
          console.error('[AutoPrint] Bill print failed:', err);
        }
        console.log('[AutoPrint] ── done ──');
      })
      .subscribe((status) => {
        console.log('[AutoPrint] Bill-print subscription status:', status);
      });

    return () => {
      console.log('[AutoPrint] Cleaning up bill-print subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // This component renders nothing — it is a side-effect-only listener.
  return null;
}

// ── Auto-print logic ─────────────────────────────────────────────────────────

async function autoPrintKOT(
  order: Order,
  restaurantId: string,
  restaurantName: string,
  printerConfig: PrinterConfig | null,
) {
  // Status intentionally stays 'placed' — kitchen taps "Food Ready" when done.
  try {
    await printKOT(order, restaurantId, restaurantName, printerConfig);
    const tableLabel = order.table
      ? `Table ${order.table.display_name?.trim() || order.table.table_number}`
      : order.order_type === 'parcel'
      ? `Parcel${order.customer_name ? ` — ${order.customer_name}` : ''}`
      : 'Dine In';
    toast.success(`Order #${order.order_number} — ${tableLabel} — Auto-printed ✓`, {
      duration: 4000,
    });
  } catch (err) {
    toast.error(`Auto-print failed for #${order.order_number} — use reprint button`);
    console.error('[AutoPrint]', err);
  }
}
