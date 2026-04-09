'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ChevronLeft, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn, formatPrice } from '@/lib/utils';

interface PendingItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

interface PendingOrder {
  restaurant_id: string;
  table_id: string | null;
  order_type: 'dine_in' | 'parcel';
  customer_name: string | null;
  customer_phone: string | null;
  notes?: string | null;
  items: PendingItem[];
}

export default function OrderReviewPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingOrder');
    if (!raw) {
      router.replace(`/${slug}`);
      return;
    }
    try {
      setOrder(JSON.parse(raw));
    } catch {
      router.replace(`/${slug}`);
    }
  }, [router, slug]);

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  async function confirmOrder() {
    if (!order) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to place order');
      }

      sessionStorage.removeItem('pendingOrder');
      router.replace(`/${slug}/order/${data.orderId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Review Order</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Order type badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold px-3 py-1 rounded-full',
              order.order_type === 'dine_in'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            )}
          >
            {order.order_type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
          </span>
          {order.order_type === 'parcel' && order.customer_name && (
            <span className="text-sm text-muted-foreground">{order.customer_name}</span>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Items
            </p>
          </div>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.product_id} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {item.quantity}× {item.name}
                    </span>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        "{item.notes}"
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Order note */}
        {order.notes && (
          <div className="bg-white rounded-xl border px-4 py-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Order Note</p>
            <p className="text-sm italic text-muted-foreground">"{order.notes}"</p>
          </div>
        )}

        {/* Total */}
        <div className="bg-white rounded-xl border px-4 py-3 flex justify-between items-center">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold">{formatPrice(total)}</span>
        </div>

        {/* Customer details for parcel */}
        {order.order_type === 'parcel' && (order.customer_name || order.customer_phone) && (
          <div className="bg-white rounded-xl border px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Your Details
            </p>
            {order.customer_name && (
              <p className="text-sm">
                <span className="text-muted-foreground">Name: </span>
                {order.customer_name}
              </p>
            )}
            {order.customer_phone && (
              <p className="text-sm">
                <span className="text-muted-foreground">Phone: </span>
                {order.customer_phone}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom confirm button */}
      <div className="bg-white border-t px-4 py-4">
        <Button
          onClick={confirmOrder}
          disabled={placing}
          className="w-full py-3 text-base font-semibold"
        >
          {placing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Placing Order…
            </>
          ) : (
            `Confirm Order · ${formatPrice(total)}`
          )}
        </Button>
      </div>
    </div>
  );
}
