'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { BellRing, ChefHat, PackageCheck, CheckCheck, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import type { Order, OrderStatus, Restaurant } from '@/types';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full order with items
            const { data } = await supabase
              .from('orders')
              .select('*, items:order_items(*), table:tables(*)')
              .eq('id', payload.new.id)
              .single();

            if (data) {
              setOrders((prev) => [data as Order, ...prev]);

              if (!isFirstRender.current) {
                // Play sound on new order
                try {
                  if (!audioRef.current) {
                    audioRef.current = new Audio('/sounds/new-order.mp3');
                  }
                  await audioRef.current.play();
                } catch {
                  // Sound failed (e.g. browser autoplay policy) — ignore
                }
                toast.success(`New order #${data.order_number} received!`, {
                  duration: 5000,
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
      .subscribe();

    // Mark first render done after subscription
    isFirstRender.current = false;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id]);

  async function advanceStatus(order: Order) {
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;

    setUpdating(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', order.id);

      if (error) throw error;
      // Realtime will update state
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
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);
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

  const activeCount = orders.filter(
    (o) => o.status === 'placed' || o.status === 'preparing'
  ).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-6 h-6" />
            Kitchen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's orders · {orders.length} total
          </p>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
            <BellRing className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">
              {activeCount} active
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-6">
        {(
          [
            { key: 'active', label: 'Active' },
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Completed' },
          ] as { key: FilterTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
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

      {/* Orders */}
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
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  onAdvance: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

function OrderCard({ order, onAdvance, onCancel, isUpdating }: OrderCardProps) {
  const statusMeta = ORDER_STATUSES.find((s) => s.value === order.status);
  const nextStatus = STATUS_FLOW[order.status];
  const isTerminal = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden',
        order.status === 'placed' && 'border-yellow-300',
        order.status === 'preparing' && 'border-blue-300',
        order.status === 'ready' && 'border-green-400',
        order.status === 'delivered' && 'border-gray-200 opacity-70',
        order.status === 'cancelled' && 'border-red-200 opacity-60'
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="font-bold text-lg">#{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold px-2 py-1 rounded-full',
              statusMeta?.color
            )}
          >
            {statusMeta?.label}
          </span>
          <span className="text-sm font-bold">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Table / parcel info */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <p className="text-sm font-medium">
          {order.order_type === 'dine_in'
            ? order.table
              ? `🪑 Table ${order.table.table_number}`
              : '🪑 Dine In'
            : `🛍️ Parcel${order.customer_name ? ` — ${order.customer_name}` : ''}`}
        </p>
        {order.customer_phone && (
          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-1.5">
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm">
                <span className="font-semibold">{item.quantity}×</span> {item.name}
              </span>
              {item.notes && (
                <p className="text-xs text-muted-foreground italic">"{item.notes}"</p>
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

      {/* Action buttons */}
      {!isTerminal && (
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button
            onClick={onAdvance}
            disabled={isUpdating}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50',
              order.status === 'placed' && 'bg-blue-500 hover:bg-blue-600',
              order.status === 'preparing' && 'bg-green-500 hover:bg-green-600',
              order.status === 'ready' && 'bg-gray-700 hover:bg-gray-800'
            )}
          >
            {isUpdating ? (
              '…'
            ) : order.status === 'placed' ? (
              <span className="flex items-center justify-center gap-1.5">
                <ChefHat className="w-4 h-4" /> {STATUS_LABELS[order.status]}
              </span>
            ) : order.status === 'preparing' ? (
              <span className="flex items-center justify-center gap-1.5">
                <PackageCheck className="w-4 h-4" /> {STATUS_LABELS[order.status]}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <CheckCheck className="w-4 h-4" /> {STATUS_LABELS[order.status]}
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
