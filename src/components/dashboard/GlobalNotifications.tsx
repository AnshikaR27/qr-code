'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Bell, X, ChefHat } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import {
  unlockAudio, playNewOrder,
  startNewOrderLoop, stopNewOrderLoop,
  startWaiterCallLoop, stopWaiterCallLoop,
} from '@/lib/sounds';
import type { Order, WaiterCall, PrinterConfig } from '@/types';

const AUDIO_PREF_KEY = 'dashboard-audio-enabled';

interface Props {
  restaurantId: string;
  restaurantName: string;
  printerConfig: PrinterConfig | null;
}

export default function GlobalNotifications({ restaurantId, restaurantName, printerConfig }: Props) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [pendingNewOrders, setPendingNewOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);

  const audioEnabledRef = useRef(false);
  const isFirstRender = useRef(true);
  const printerConfigRef = useRef(printerConfig);
  printerConfigRef.current = printerConfig;

  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  // Restore audio pref on mount.
  // Do NOT call unlockAudio() here — creating an AudioContext without a user
  // gesture triggers a browser warning. AutoPrintListener's click listener
  // will unlock audio on the user's first interaction.
  useEffect(() => {
    if (localStorage.getItem(AUDIO_PREF_KEY) === 'true') {
      setAudioEnabled(true);
    }
  }, []);

  // Loop management: new orders
  useEffect(() => {
    if (!audioEnabled) return;
    if (pendingNewOrders.length > 0) {
      startNewOrderLoop();
    } else {
      stopNewOrderLoop();
    }
  }, [pendingNewOrders.length, audioEnabled]);

  // Loop management: waiter calls
  useEffect(() => {
    if (!audioEnabled) return;
    const active = waiterCalls.filter((c) => c.status === 'pending');
    if (active.length > 0) {
      startWaiterCallLoop();
    } else {
      stopWaiterCallLoop();
    }
  }, [waiterCalls, audioEnabled]);

  // Stop all loops on unmount
  useEffect(() => {
    return () => {
      stopNewOrderLoop();
      stopWaiterCallLoop();
    };
  }, []);

  // Page title with unread count
  useEffect(() => {
    const unread = pendingNewOrders.length + waiterCalls.filter((c) => c.status === 'pending').length;
    document.title = unread > 0
      ? `(${unread}) Kitchen — ${restaurantName}`
      : `Kitchen — ${restaurantName}`;
    return () => { document.title = restaurantName; };
  }, [pendingNewOrders.length, waiterCalls, restaurantName]);

  async function handleEnableAudio() {
    try {
      await unlockAudio();
      localStorage.setItem(AUDIO_PREF_KEY, 'true');
      setAudioEnabled(true);
      playNewOrder();
      toast.success('Audio notifications enabled!');
    } catch {
      toast.error('Could not enable audio. Try again.');
    }
  }

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          if (isFirstRender.current) return;
          const { data } = await supabase
            .from('orders')
            .select('*, items:order_items(*), table:tables(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            const order = data as Order;
            // In auto-print mode AutoPrintListener handles the notification
            // (chime + toast). Suppress the looping Accept banner here so staff
            // aren't shown a redundant popup for an already-accepted order.
            const isAutoPrint = printerConfigRef.current?.kot_print_trigger === 'on_order';
            if (!isAutoPrint) {
              setPendingNewOrders((prev) => [order, ...prev]);
            }
            if (document.hidden && Notification.permission === 'granted') {
              new Notification(`New order #${order.order_number}`, {
                body: `${restaurantName} — ${order.items?.length ?? 0} item(s)`,
                icon: '/favicon.ico',
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          if (isFirstRender.current) return;
          const { data } = await supabase
            .from('waiter_calls')
            .select('*, table:tables(table_number, display_name)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setWaiterCalls((prev) => [data as WaiterCall, ...prev]);
          }
        }
      )
      .subscribe();

    isFirstRender.current = false;
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, restaurantName]);

  const acceptOrder = useCallback(async (order: Order) => {
    setPendingNewOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      const supabase = createClient();
      await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id);
      // Print KOT immediately on accept (on_accept mode)
      const config = printerConfigRef.current;
      const { printKOT } = await import('@/lib/kot-print');
      await printKOT(order, restaurantId, restaurantName, config);
      toast.success(`KOT printed — Order #${order.order_number}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept order');
      setPendingNewOrders((prev) => [order, ...prev]);
    }
  }, [restaurantId, restaurantName]);

  const dismissWaiterCall = useCallback(async (callId: string) => {
    setWaiterCalls((prev) =>
      prev.map((c) => c.id === callId ? { ...c, status: 'acknowledged' as const } : c)
    );
    try {
      const supabase = createClient();
      await supabase.from('waiter_calls').update({ status: 'acknowledged' }).eq('id', callId);
    } catch { /* best-effort */ }
  }, []);

  const pendingWaiterCalls = waiterCalls.filter((c) => c.status === 'pending');
  const hasNotifications = !audioEnabled || pendingWaiterCalls.length > 0 || pendingNewOrders.length > 0;

  if (!hasNotifications) return null;

  return (
    <>
      <style>{`
        @keyframes urgentPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
        @keyframes orderPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50%       { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
        }
        .gn-pulse-waiter { animation: urgentPulse 2s ease-in-out infinite; }
        .gn-pulse-order  { animation: orderPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="sticky top-0 z-50 flex flex-col gap-2 px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        {/* Audio enable banner */}
        {!audioEnabled && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                Enable audio notifications for new orders and waiter calls
              </p>
            </div>
            <button
              onClick={handleEnableAudio}
              className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Enable Sound
            </button>
          </div>
        )}

        {/* Waiter call banners */}
        {pendingWaiterCalls.map((call) => (
          <div
            key={call.id}
            className="gn-pulse-waiter flex items-center justify-between gap-4 px-5 py-4 bg-red-50 border-2 border-red-400 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>🔔</span>
              <div>
                <p className="text-base font-bold text-red-800">
                  {call.table ? `Table ${call.table.display_name?.trim() || call.table.table_number}` : 'A table'} is calling for a waiter!
                </p>
                <p className="text-xs text-red-500 mt-0.5">
                  {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismissWaiterCall(call.id)}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors"
            >
              <X className="w-4 h-4" /> Dismiss
            </button>
          </div>
        ))}

        {/* New order banners */}
        {pendingNewOrders.map((order) => {
          const count = order.items?.length ?? 0;
          const tableLabel = order.table ? `Table ${order.table.display_name?.trim() || order.table.table_number}` : 'Dine In';
          return (
            <div
              key={order.id}
              className="gn-pulse-order flex items-center justify-between gap-4 px-5 py-4 bg-amber-50 border-2 border-amber-400 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>🆕</span>
                <div>
                  <p className="text-base font-bold text-amber-900">
                    New order · {tableLabel} · {count} item{count !== 1 ? 's' : ''} · {formatPrice(order.total)}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    #{order.order_number} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => acceptOrder(order)}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <ChefHat className="w-4 h-4" /> Accept
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
