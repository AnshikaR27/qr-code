'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { BellRing, ChefHat, PackageCheck, CheckCheck, XCircle, Bell, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import {
  unlockAudio, playNewOrder,
  startNewOrderLoop, stopNewOrderLoop,
  startWaiterCallLoop, stopWaiterCallLoop,
} from '@/lib/sounds';
import type { Order, OrderStatus, Restaurant, WaiterCall } from '@/types';

const AUDIO_PREF_KEY = 'dashboard-audio-enabled';

interface Props {
  restaurant: Restaurant;
  initialOrders: Order[];
}

type FilterTab = 'active' | 'all' | 'completed';

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  placed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
  cancelled: null,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Mark Delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function KitchenDashboard({ restaurant, initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<FilterTab>('active');
  const [updating, setUpdating] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Unaccepted new orders — initialized from any already-placed orders on load
  const [pendingNewOrders, setPendingNewOrders] = useState<Order[]>(
    () => initialOrders.filter((o) => o.status === 'placed')
  );

  // Active waiter calls
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);

  const isFirstRender = useRef(true);
  const audioEnabledRef = useRef(false);
  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  // ── Restore audio pref ─────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem(AUDIO_PREF_KEY) === 'true') {
      setAudioEnabled(true);
      unlockAudio().catch(() => {});
    }
  }, []);

  // ── Loop management: new orders ────────────────────────────────────────────
  useEffect(() => {
    if (!audioEnabled) return;
    if (pendingNewOrders.length > 0) {
      startNewOrderLoop();
    } else {
      stopNewOrderLoop();
    }
  }, [pendingNewOrders.length, audioEnabled]);

  // ── Loop management: waiter calls ──────────────────────────────────────────
  useEffect(() => {
    if (!audioEnabled) return;
    const active = waiterCalls.filter((c) => c.status === 'pending');
    if (active.length > 0) {
      startWaiterCallLoop();
    } else {
      stopWaiterCallLoop();
    }
  }, [waiterCalls, audioEnabled]);

  // ── Stop all loops on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopNewOrderLoop();
      stopWaiterCallLoop();
    };
  }, []);

  // ── Browser tab title with unread count ───────────────────────────────────
  useEffect(() => {
    const unread = pendingNewOrders.length + waiterCalls.filter((c) => c.status === 'pending').length;
    document.title = unread > 0
      ? `(${unread}) Kitchen — ${restaurant.name}`
      : `Kitchen — ${restaurant.name}`;
    return () => { document.title = restaurant.name; };
  }, [pendingNewOrders.length, waiterCalls, restaurant.name]);

  // ── Enable audio ───────────────────────────────────────────────────────────
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

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('kitchen-realtime')
      // Orders
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data } = await supabase
              .from('orders')
              .select('*, items:order_items(*), table:tables(*)')
              .eq('id', payload.new.id)
              .single();

            if (data && !isFirstRender.current) {
              const order = data as Order;
              setOrders((prev) => [order, ...prev]);
              setPendingNewOrders((prev) => [order, ...prev]);
              // Loop starts via the useEffect watching pendingNewOrders.length

              if (document.hidden && Notification.permission === 'granted') {
                new Notification(`New order #${order.order_number}`, {
                  body: `${restaurant.name} — ${order.items?.length ?? 0} item(s)`,
                  icon: '/favicon.ico',
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      // Waiter calls
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurant.id}` },
        async (payload) => {
          if (isFirstRender.current) return;
          const { data } = await supabase
            .from('waiter_calls')
            .select('*, table:tables(table_number)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setWaiterCalls((prev) => [data as WaiterCall, ...prev]);
            // Loop starts via the useEffect watching waiterCalls
          }
        }
      )
      .subscribe();

    isFirstRender.current = false;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // ── Accept order (stops sound when last pending is accepted) ───────────────
  const acceptOrder = useCallback(async (order: Order) => {
    setPendingNewOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      const supabase = createClient();
      await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept order');
      // Re-add if failed
      setPendingNewOrders((prev) => [order, ...prev]);
    }
  }, []);

  // ── Dismiss waiter call ────────────────────────────────────────────────────
  const dismissWaiterCall = useCallback(async (callId: string) => {
    setWaiterCalls((prev) =>
      prev.map((c) => c.id === callId ? { ...c, status: 'acknowledged' as const } : c)
    );
    try {
      const supabase = createClient();
      await supabase.from('waiter_calls').update({ status: 'acknowledged' }).eq('id', callId);
    } catch { /* best-effort */ }
  }, []);

  // ── Advance / cancel order ─────────────────────────────────────────────────
  async function advanceStatus(order: Order) {
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;
    setUpdating(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setUpdating(null);
    }
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`Cancel order #${order.order_number}?`)) return;
    setUpdating(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setUpdating(null);
    }
  }

  const filtered = orders.filter((o) => {
    if (filter === 'active') return o.status === 'placed' || o.status === 'preparing';
    if (filter === 'completed') return o.status === 'delivered' || o.status === 'cancelled';
    return true;
  });

  const activeCount = orders.filter((o) => o.status === 'placed' || o.status === 'preparing').length;
  const pendingWaiterCalls = waiterCalls.filter((c) => c.status === 'pending');

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
        .pulse-waiter { animation: urgentPulse 2s ease-in-out infinite; }
        .pulse-order  { animation: orderPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="p-6 max-w-5xl mx-auto space-y-3">

        {/* ── Enable audio ── */}
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

        {/* ── Waiter call banners ── */}
        {pendingWaiterCalls.map((call) => (
          <div
            key={call.id}
            className="pulse-waiter flex items-center justify-between gap-4 px-5 py-4 bg-red-50 border-2 border-red-400 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>🔔</span>
              <div>
                <p className="text-base font-bold text-red-800">
                  {call.table ? `Table ${call.table.table_number}` : 'A table'} is calling for a waiter!
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

        {/* ── New order notification cards ── */}
        {pendingNewOrders.map((order) => {
          const itemCount = order.items?.length ?? 0;
          const tableLabel = order.table ? `Table ${order.table.table_number}` : 'Dine In';
          return (
            <div
              key={order.id}
              className="pulse-order flex items-center justify-between gap-4 px-5 py-4 bg-amber-50 border-2 border-amber-400 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>🆕</span>
                <div>
                  <p className="text-base font-bold text-amber-900">
                    New order · {tableLabel} · {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(order.total)}
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
                <ChefHat className="w-4 h-4" /> Accept Order
              </button>
            </div>
          );
        })}

        {/* ── Header ── */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ChefHat className="w-6 h-6" /> Kitchen
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Today&apos;s orders · {orders.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {audioEnabled && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Bell className="w-3 h-3" /> Sound on
              </span>
            )}
            {activeCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                <BellRing className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700">{activeCount} active</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {([
            { key: 'active', label: 'Active' },
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Completed' },
          ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
              {key === 'active' && activeCount > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Orders grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">
              {filter === 'active' ? 'No active orders' : 'No orders yet today'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={() => advanceStatus(order)}
                onCancel={() => cancelOrder(order)}
                isUpdating={updating === order.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── OrderCard ──────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  onAdvance: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

function OrderCard({ order, onAdvance, onCancel, isUpdating }: OrderCardProps) {
  const statusMeta = ORDER_STATUSES.find((s) => s.value === order.status);
  const isTerminal = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden',
        order.status === 'placed'    && 'border-yellow-300',
        order.status === 'preparing' && 'border-blue-300',
        order.status === 'ready'     && 'border-green-400',
        order.status === 'delivered' && 'border-gray-200 opacity-70',
        order.status === 'cancelled' && 'border-red-200 opacity-60'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="font-bold text-lg">#{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', statusMeta?.color)}>
            {statusMeta?.label}
          </span>
          <span className="text-sm font-bold">{formatPrice(order.total)}</span>
        </div>
      </div>

      <div className="px-4 py-2 border-b bg-gray-50">
        <p className="text-sm font-medium">
          {order.order_type === 'dine_in'
            ? order.table ? `🪑 Table ${order.table.table_number}` : '🪑 Dine In'
            : `🛍️ Parcel${order.customer_name ? ` — ${order.customer_name}` : ''}`}
        </p>
        {order.customer_phone && (
          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
        )}
      </div>

      <div className="flex-1 px-4 py-3 space-y-1.5">
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm">
                <span className="font-semibold">{item.quantity}×</span> {item.name}
              </span>
              {item.notes && (
                <p className="text-xs text-muted-foreground italic">&ldquo;{item.notes}&rdquo;</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatPrice(item.price * item.quantity)}
            </span>
          </div>
        ))}
        {order.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2 mt-2 italic">
            Note: {order.notes}
          </p>
        )}
      </div>

      {!isTerminal && (
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button
            onClick={onAdvance}
            disabled={isUpdating}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50',
              order.status === 'placed'    && 'bg-blue-500 hover:bg-blue-600',
              order.status === 'preparing' && 'bg-green-500 hover:bg-green-600',
              order.status === 'ready'     && 'bg-gray-700 hover:bg-gray-800'
            )}
          >
            {isUpdating ? '…' : (
              <span className="flex items-center justify-center gap-1.5">
                {order.status === 'placed'    && <ChefHat className="w-4 h-4" />}
                {order.status === 'preparing' && <PackageCheck className="w-4 h-4" />}
                {order.status === 'ready'     && <CheckCheck className="w-4 h-4" />}
                {STATUS_LABELS[order.status]}
              </span>
            )}
          </button>
          {order.status === 'placed' && (
            <button
              onClick={onCancel}
              disabled={isUpdating}
              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              title="Cancel order"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
