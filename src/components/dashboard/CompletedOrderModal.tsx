'use client';

import { format } from 'date-fns';
import { X, ReceiptText } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { computeBill } from '@/lib/billing';
import type { Order, Restaurant } from '@/types';

interface Props {
  order: Order;
  restaurant: Restaurant;
  onClose: () => void;
  onPrintBill: () => void;
}

export default function CompletedOrderModal({ order, restaurant, onClose, onPrintBill }: Props) {
  const activeItems = (order.items ?? []).filter(i => i.status !== 'voided');
  const billingConfig = restaurant.billing_config;
  const bill = billingConfig ? computeBill(activeItems, billingConfig) : null;

  const tableLabel = order.table
    ? (order.table.display_name?.trim() || `#${order.table.table_number}`)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              Order #{order.order_number}
              {order.status === 'cancelled' ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Cancelled</span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tableLabel ? `Table ${tableLabel}` : 'Parcel'}
              {order.customer_name ? ` · ${order.customer_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Items */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Items</h3>
            <div className="space-y-1.5">
              {(order.items ?? []).map((item) => {
                const isVoided = item.status === 'voided';
                const addonTotal = (item.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
                return (
                  <div key={item.id} className={isVoided ? 'opacity-40' : ''}>
                    <div className="flex justify-between gap-2">
                      <span className={cn('text-sm', isVoided && 'line-through')}>
                        <span className="font-semibold">{item.quantity}×</span> {item.name}
                        {isVoided && <span className="ml-1 text-[10px] font-bold text-red-500">VOID</span>}
                      </span>
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {formatPrice((item.price + addonTotal) * item.quantity)}
                      </span>
                    </div>
                    {(item.selected_addons ?? []).map((addon, ai) => (
                      <div key={ai} className="flex justify-between gap-2 pl-5">
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

          {/* Payment */}
          {order.payment_method && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Payment</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {order.payment_method.toUpperCase()}
                </span>
                <span className="text-sm font-bold">{formatPrice(order.total)}</span>
              </div>
              {order.payment_methods && order.payment_methods.length > 1 && (
                <div className="mt-1.5 space-y-0.5">
                  {order.payment_methods.map((pm, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {pm.method.toUpperCase()}: {formatPrice(pm.amount)}
                    </p>
                  ))}
                </div>
              )}
              {order.discount_amount && order.discount_amount > 0 && (
                <p className="text-xs text-green-700 mt-1">
                  Discount: {order.discount_type === 'percentage' ? `${order.discount_amount}%` : formatPrice(order.discount_amount)}
                  {order.discount_before_tax ? ' (before tax)' : ' (after tax)'}
                </p>
              )}
            </div>
          )}

          {/* GST Breakdown */}
          {bill && bill.tax_lines.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Tax Breakdown</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(bill.subtotal)}</span>
                </div>
                {bill.service_charge_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service charge ({bill.service_charge_percent}%)</span>
                    <span>{formatPrice(bill.service_charge_amount)}</span>
                  </div>
                )}
                {bill.tax_lines.map((tl, i) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST @ {tl.cgst_rate}%</span>
                      <span>{formatPrice(tl.cgst_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST @ {tl.sgst_rate}%</span>
                      <span>{formatPrice(tl.sgst_amount)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1.5">
                  <span>Total</span>
                  <span>{formatPrice(bill.grand_total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Timeline</h3>
            <div className="space-y-2">
              <TimelineRow label="Placed" time={order.created_at} />
              {order.status !== 'cancelled' && order.updated_at && order.updated_at !== order.created_at && (
                <TimelineRow label="Ready / Updated" time={order.updated_at} />
              )}
              {order.payment_method && (
                <TimelineRow label={`Paid (${order.payment_method.toUpperCase()})`} time={order.updated_at ?? order.created_at} />
              )}
              {order.status === 'cancelled' && (
                <TimelineRow label="Cancelled" time={order.updated_at ?? order.created_at} />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {order.status !== 'cancelled' && (
          <div className="px-6 py-4 border-t">
            <button
              onClick={() => { onPrintBill(); onClose(); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <ReceiptText className="w-4 h-4" />
              Reprint Bill
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{format(new Date(time), 'h:mm a')}</span>
      </div>
    </div>
  );
}
