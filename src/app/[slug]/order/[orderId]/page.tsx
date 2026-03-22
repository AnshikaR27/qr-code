'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, Clock, ChefHat, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/types';

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'placed',    label: 'Order Placed',  icon: Clock },
  { status: 'preparing', label: 'Preparing',      icon: ChefHat },
  { status: 'ready',     label: 'Ready!',         icon: PackageCheck },
];

function statusIndex(s: OrderStatus) {
  const idx = STEPS.findIndex((step) => step.status === s);
  return idx === -1 ? STEPS.length : idx;
}

export default function OrderStatusPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    async function fetchOrder() {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', orderId)
        .single();

      if (err || !data) {
        setError('Order not found');
        setLoading(false);
        return;
      }

      setOrder(data as Order);
      setItems((data.items ?? []) as OrderItem[]);
      setLoading(false);
    }

    fetchOrder();

    // Realtime subscription — listen for status changes on this order
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder((prev) =>
            prev ? { ...prev, ...(payload.new as Partial<Order>) } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4">
        <p className="text-muted-foreground">{error || 'Order not found'}</p>
        <Link href={`/${slug}`} className="text-sm underline">
          Back to menu
        </Link>
      </div>
    );
  }

  const currentIdx = statusIndex(order.status);
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto px-4 py-6 gap-5">
      {/* Order number */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
        <h1 className="text-2xl font-bold mt-1">
          {isCancelled
            ? '❌ Order Cancelled'
            : isDelivered
            ? '✅ Delivered!'
            : 'Tracking your order'}
        </h1>
        {!isCancelled && !isDelivered && (
          <p className="text-sm text-muted-foreground mt-1">
            This page updates automatically
          </p>
        )}
      </div>

      {/* Progress steps */}
      {!isCancelled && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-8" />
            <div
              className="absolute left-0 top-5 h-0.5 bg-green-500 mx-8 transition-all duration-700"
              style={{
                width: `${(currentIdx / (STEPS.length - 1)) * 100}%`,
                right: 'auto',
              }}
            />

            {STEPS.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const Icon = step.icon;
              return (
                <div key={step.status} className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors',
                      done || active
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-200 text-gray-300'
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : active ? (
                      <Icon className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium text-center',
                      done || active ? 'text-green-700' : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Your Items
          </p>
          <span className="text-sm font-bold">{formatPrice(total)}</span>
        </div>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-2.5 flex justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-sm">
                  {item.quantity}× {item.name}
                </span>
                {item.notes && (
                  <p className="text-xs text-muted-foreground italic mt-0.5">
                    "{item.notes}"
                  </p>
                )}
              </div>
              <span className="text-sm font-medium flex-shrink-0">
                {formatPrice(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Order type info */}
      <div className="bg-white rounded-xl border px-4 py-3 flex justify-between text-sm">
        <span className="text-muted-foreground">Order type</span>
        <span className="font-medium">
          {order.order_type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
          {order.customer_name && ` · ${order.customer_name}`}
        </span>
      </div>

      {/* Back to menu */}
      <Link
        href={`/${slug}`}
        className="text-center text-sm text-muted-foreground underline underline-offset-2"
      >
        Back to menu
      </Link>
    </div>
  );
}
