'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { playNewOrder, playOrderAlert, unlockAudio } from '@/lib/sounds';
import { printKOT } from '@/lib/kot-print';
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

// ── Auto-print logic ─────────────────────────────────────────────────────────

async function autoPrintKOT(
  order: Order,
  restaurantId: string,
  restaurantName: string,
  printerConfig: PrinterConfig | null,
) {
  // Advance to 'preparing' regardless of print outcome
  try {
    const supabase = createClient();
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id);
  } catch (err) {
    console.error('[AutoPrint] Failed to advance order status:', err);
  }

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
