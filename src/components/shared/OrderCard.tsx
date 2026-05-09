'use client';

import { formatDistanceToNow } from 'date-fns';
import { cn, formatPrice } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import type { Order, OrderStatus, PaymentStatus } from '@/types';

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUSES.find(s => s.value === status);
  if (!meta) return null;
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', meta.color)}>
      {meta.label}
    </span>
  );
}

function PaymentPill({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    unpaid: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    refunded: 'bg-red-50 text-red-600 border-red-200',
    comped: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', styles[status])}>
      {status === 'unpaid' ? 'Unpaid' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: false });
}

type OrderCardProps = {
  order: Order;
  variant?: 'full' | 'compact';
  showActions?: boolean;
  onTap?: (orderId: string) => void;
};

export default function OrderCard({ order, variant = 'compact', onTap }: OrderCardProps) {
  const tableLabel = order.order_type === 'dine_in'
    ? order.table
      ? `Table ${order.table.display_name?.trim() || order.table.table_number}`
      : 'Dine In'
    : 'Parcel';

  if (variant === 'compact') {
    return (
      <button
        onClick={onTap ? () => onTap(order.id) : undefined}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border hover:shadow-sm transition-shadow text-left',
          onTap && 'cursor-pointer',
        )}
      >
        <div className="flex-shrink-0 w-12 text-center">
          <p className="text-sm font-bold text-foreground">#{order.order_number}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{tableLabel}</span>
            {order.customer_name && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {order.customer_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusPill status={order.status} />
          <PaymentPill status={order.payment_status} />
          <span className="text-sm font-semibold w-16 text-right">{formatPrice(order.total)}</span>
          <span className="text-xs text-muted-foreground w-14 text-right hidden sm:block">
            {timeAgo(order.created_at)}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={onTap ? () => onTap(order.id) : undefined}
      className={cn(
        'bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden',
        order.status === 'placed' && 'border-gray-300',
        order.status === 'preparing' && 'border-amber-300',
        order.status === 'ready' && 'border-green-400',
        order.status === 'served' && 'border-gray-200 opacity-70',
        order.status === 'cancelled' && 'border-red-200 opacity-60',
        onTap && 'cursor-pointer hover:shadow-md transition-shadow',
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
          <StatusPill status={order.status} />
          <PaymentPill status={order.payment_status} />
          <span className="text-sm font-bold">{formatPrice(order.total)}</span>
        </div>
      </div>

      <div className="px-4 py-2 border-b bg-gray-50">
        <p className="text-sm font-medium">
          {tableLabel}
          {order.customer_name ? ` · ${order.customer_name}` : ''}
        </p>
      </div>

      <div className="flex-1 px-4 py-3 space-y-1.5">
        {(order.items ?? []).map(item => {
          const addonTotal = (item.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
          return (
            <div key={item.id}>
              <div className="flex justify-between gap-2">
                <span className={cn('text-sm', item.status === 'voided' && 'line-through opacity-50')}>
                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatPrice((item.price + addonTotal) * item.quantity)}
                </span>
              </div>
              {(item.selected_addons ?? []).map((addon, ai) => (
                <div key={ai} className="flex justify-between gap-2 pl-4">
                  <span className="text-xs text-muted-foreground">+ {addon.name}</span>
                  {addon.price > 0 && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">+{formatPrice(addon.price)}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { StatusPill, PaymentPill };
