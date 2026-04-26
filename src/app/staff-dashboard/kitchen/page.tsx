'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChefHat, CheckCheck, Clock, Flame, Volume2, VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { hasPermission } from '@/lib/staff-permissions';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

export default function KitchenStaffPage() {
  const { staff, restaurant } = useStaff();

  if (!hasPermission(staff.role, 'order:set_ready')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <p className="text-sm">You don&apos;t have access to this page.</p>
      </div>
    );
  }
  const [orders, setOrders] = useState<Order[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*), table:tables(id, table_number, display_name)')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    if (data) {
      const newIds = new Set(data.map((o: Order) => o.id));
      if (initialLoadDone.current && soundEnabled) {
        const hasNew = data.some(
          (o: Order) => o.status === 'placed' && !prevOrderIdsRef.current.has(o.id)
        );
        if (hasNew) {
          import('@/lib/sounds').then(({ playOrderAlert }) => playOrderAlert());
        }
      }
      prevOrderIdsRef.current = newIds;
      initialLoadDone.current = true;
      setOrders(data as Order[]);
    }
  }, [restaurant.id, soundEnabled]);

  useEffect(() => {
    fetchOrders();
    const supabase = createClient();
    const channel = supabase
      .channel('kitchen-staff-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchOrders(),
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => fetchOrders(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant.id, fetchOrders]);

  async function enableSound() {
    const { unlockAudio } = await import('@/lib/sounds');
    await unlockAudio();
    setSoundEnabled(true);
  }

  async function markReady(order: Order) {
    setUpdating(order.id);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update order');
      }

      try {
        const isTableService = restaurant.service_mode === 'table_service';
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            title: isTableService ? 'Your food is on its way!' : 'Your order is ready!',
            body: isTableService
              ? `Order #${order.order_number} — your food is being brought to your table.`
              : `Order #${order.order_number} — please collect from the counter`,
            url: `/${restaurant.slug}/order/${order.id}`,
          }),
        });
      } catch { /* push is best-effort */ }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark ready');
    } finally {
      setUpdating(null);
    }
  }

  const pendingOrders = orders.filter(
    (o) => o.status === 'placed' && !o.payment_method
  );
  const readyOrders = orders.filter(
    (o) => o.status === 'ready' && !o.payment_method
  );
  const displayOrders = [...pendingOrders, ...readyOrders];
  const newCount = pendingOrders.length;

  // Auto-tick timer for ready-since timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    if (readyOrders.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [readyOrders.length]);

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-6 h-6" /> Kitchen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Incoming orders · mark ready when done
          </p>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700">{newCount} to prepare</span>
            </div>
          )}
          {readyOrders.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCheck className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-green-700">{readyOrders.length} awaiting pickup</span>
            </div>
          )}
          <button
            onClick={() => soundEnabled ? setSoundEnabled(false) : enableSound()}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
              soundEnabled
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
            )}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Sound ON' : 'Sound OFF'}
          </button>
        </div>
      </div>

      {/* Orders */}
      {displayOrders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No active orders</p>
          <p className="text-xs mt-1">Orders will appear here in real-time</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayOrders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              onMarkReady={() => markReady(order)}
              isUpdating={updating === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function readyMinutesAgo(order: Order): number {
  const readyAt = new Date(order.updated_at ?? order.created_at);
  return Math.floor((Date.now() - readyAt.getTime()) / 60_000);
}

function KitchenOrderCard({
  order,
  onMarkReady,
  isUpdating,
}: {
  order: Order;
  onMarkReady: () => void;
  isUpdating: boolean;
}) {
  const isNew = order.status === 'placed';
  const isReady = order.status === 'ready';
  const tableLabel = order.table
    ? (order.table.display_name?.trim() || `#${order.table.table_number}`)
    : 'Parcel';

  const activeItems = (order.items ?? []).filter((i) => i.status !== 'voided');
  const readyMins = isReady ? readyMinutesAgo(order) : 0;
  const readySlow = readyMins >= 5;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 shadow-sm flex flex-col overflow-hidden',
        isNew && 'border-amber-400',
        isReady && 'border-green-400 opacity-60',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        isNew ? 'bg-amber-50' : 'bg-green-50',
      )}>
        <div>
          <p className="font-bold text-lg">#{order.order_number}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-medium text-gray-600">
              Table {tableLabel}
            </span>
            {order.customer_name && (
              <span className="text-xs text-muted-foreground">
                · {order.customer_name}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          {isNew ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-200 text-amber-800">
              NEW
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-200 text-green-800">
              AWAITING PICKUP
            </span>
          )}
          <div className={cn(
            'flex items-center gap-1 mt-1.5 text-xs',
            isReady && readySlow ? 'text-red-600 font-semibold' : 'text-muted-foreground',
          )}>
            <Clock className="w-3 h-3" />
            {isReady
              ? `Ready ${readyMins < 1 ? 'just now' : `${readyMins} min ago`}`
              : formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
            }
          </div>
        </div>
      </div>

      {/* Items — the main focus for kitchen */}
      <div className="flex-1 px-4 py-3 space-y-2">
        {activeItems.map((item) => (
          <div key={item.id}>
            <div className="flex items-start gap-2">
              <span className="font-bold text-base text-amber-700 min-w-[28px]">
                {item.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold">{item.name}</span>
                {(item.selected_addons ?? []).length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {(item.selected_addons ?? []).map((addon, ai) => (
                      <p key={ai} className="text-xs text-muted-foreground pl-1">
                        + {addon.name}
                      </p>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="text-xs text-red-600 font-medium mt-0.5 italic">
                    &ldquo;{item.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {order.notes && (
          <p className="text-xs text-red-600 font-medium border-t pt-2 mt-2 italic">
            Order note: {order.notes}
          </p>
        )}
      </div>

      {/* Action */}
      {isNew && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onMarkReady}
            disabled={isUpdating}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              '...'
            ) : (
              <>
                <CheckCheck className="w-5 h-5" />
                Mark Ready
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
