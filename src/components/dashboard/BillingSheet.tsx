'use client';

import { useState, useMemo, useEffect } from 'react';
import { Banknote, Smartphone, CreditCard, Percent, IndianRupee, Loader2, SplitSquareHorizontal } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { computeBill } from '@/lib/billing';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import type { Order, OrderItem, PaymentMethod, SplitPayment, BillingConfig, Restaurant } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAY_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; color: string; selected: string }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'border-gray-200 hover:border-green-300 hover:bg-green-50', selected: 'border-green-400 bg-green-50 text-green-700 ring-2 ring-green-300' },
  { value: 'upi',  label: 'UPI',  icon: Smartphone, color: 'border-gray-200 hover:border-purple-300 hover:bg-purple-50', selected: 'border-purple-400 bg-purple-50 text-purple-700 ring-2 ring-purple-300' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'border-gray-200 hover:border-blue-300 hover:bg-blue-50', selected: 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-300' },
];

function r2(n: number) { return Math.round(n * 100) / 100; }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Single order or multiple (table-level combined billing) */
  orders: Order[] | null;
  restaurant: Restaurant;
  onConfirm: (orderIds: string[], data: BillingConfirmData) => Promise<void>;
  onClose: () => void;
}

export interface BillingConfirmData {
  payment_method: PaymentMethod;
  payment_methods: SplitPayment[] | null;
  discount_amount: number | null;
  discount_type: 'flat' | 'percentage' | null;
  discount_before_tax: boolean;
  grand_total: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingSheet({ orders, restaurant, onConfirm, onClose }: Props) {
  const open = !!orders && orders.length > 0;
  const config = restaurant.billing_config;

  // Discount state
  const [discountInput, setDiscountInput] = useState('');
  const [discountMode, setDiscountMode] = useState<'flat' | 'percentage'>('flat');
  const [discountBeforeTax, setDiscountBeforeTax] = useState(true);

  // Payment state
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [splitRows, setSplitRows] = useState<{ method: PaymentMethod; amount: string }[]>([
    { method: 'cash', amount: '' },
    { method: 'upi', amount: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setDiscountInput('');
      setDiscountMode('flat');
      setDiscountBeforeTax(true);
      setPayMethod(null);
      setCashReceived('');
      setIsSplit(false);
      setSplitRows([{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }]);
    }
  }, [open]);

  // Combine all items from all orders
  const allItems: OrderItem[] = useMemo(() => {
    if (!orders) return [];
    return orders.flatMap(o => o.items ?? []);
  }, [orders]);

  // Bill computation
  const bill = useMemo(() => {
    if (!config || allItems.length === 0) return null;
    return computeBill(allItems, config);
  }, [allItems, config]);

  // Discount math
  const discountValue = parseFloat(discountInput) || 0;

  const { discountedSubtotal, discountAmount, grandTotal, roundOff } = useMemo(() => {
    if (!bill) return { discountedSubtotal: 0, discountAmount: 0, grandTotal: 0, roundOff: 0 };

    const rawDiscount = discountMode === 'percentage'
      ? r2(bill.subtotal * discountValue / 100)
      : discountValue;
    const clampedDiscount = Math.min(Math.max(rawDiscount, 0), bill.subtotal);

    if (discountBeforeTax) {
      // Discount before tax: reduce subtotal, recalc tax on reduced amount
      const newSubtotal = r2(bill.subtotal - clampedDiscount);
      const taxRatio = bill.subtotal > 0 ? newSubtotal / bill.subtotal : 0;
      const adjustedTax = r2(bill.total_tax * taxRatio);
      const sc = bill.service_charge_amount > 0
        ? r2(bill.service_charge_amount * taxRatio) : 0;
      const raw = newSubtotal + adjustedTax + sc;
      const rounded = Math.round(raw);
      return {
        discountedSubtotal: newSubtotal,
        discountAmount: clampedDiscount,
        grandTotal: rounded,
        roundOff: r2(rounded - raw),
      };
    } else {
      // Discount after tax: apply to grand total
      const preDiscount = bill.subtotal + bill.total_tax + bill.service_charge_amount;
      const raw = preDiscount - clampedDiscount;
      const rounded = Math.round(Math.max(raw, 0));
      return {
        discountedSubtotal: bill.subtotal,
        discountAmount: clampedDiscount,
        grandTotal: rounded,
        roundOff: r2(rounded - raw),
      };
    }
  }, [bill, discountValue, discountMode, discountBeforeTax]);

  // Cash change
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const cashChange = payMethod === 'cash' && cashReceivedNum > grandTotal
    ? r2(cashReceivedNum - grandTotal) : 0;

  // Split validation
  const splitTotal = isSplit
    ? splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    : 0;
  const splitRemaining = isSplit ? r2(grandTotal - splitTotal) : 0;

  // Can confirm?
  const canConfirm = (() => {
    if (submitting || grandTotal <= 0) return false;
    if (isSplit) {
      return Math.abs(splitRemaining) < 1; // allow ₹1 tolerance
    }
    return !!payMethod;
  })();

  async function handleConfirm() {
    if (!orders || !canConfirm) return;
    setSubmitting(true);
    try {
      const data: BillingConfirmData = {
        payment_method: isSplit ? splitRows[0].method : payMethod!,
        payment_methods: isSplit
          ? splitRows
              .filter(r => (parseFloat(r.amount) || 0) > 0)
              .map(r => ({ method: r.method, amount: parseFloat(r.amount) || 0 }))
          : null,
        discount_amount: discountAmount > 0 ? discountAmount : null,
        discount_type: discountAmount > 0 ? discountMode : null,
        discount_before_tax: discountBeforeTax,
        grand_total: grandTotal,
      };
      await onConfirm(orders.map(o => o.id), data);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // Detect if orders span multiple tables (merge group billing)
  const uniqueTableIds = new Set(orders.filter(o => o.table_id).map(o => o.table_id!));
  const isMultiTable = uniqueTableIds.size > 1;

  const orderLabel = isMultiTable
    ? (() => {
        const tableLabels = orders
          .filter(o => o.table)
          .reduce((acc, o) => {
            const label = o.table!.display_name?.trim() || String(o.table!.table_number);
            if (!acc.includes(label)) acc.push(label);
            return acc;
          }, [] as string[]);
        return `Table ${tableLabels.join(' + ')} · ${orders.length} Orders`;
      })()
    : orders.length === 1
      ? `Order #${orders[0].order_number}`
      : `${orders.length} Orders Combined`;

  return (
    <Sheet open onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 overflow-hidden sm:max-w-md">
        <SheetHeader className="border-b p-4 flex-shrink-0">
          <SheetTitle>Record Payment</SheetTitle>
          <SheetDescription>{orderLabel}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* ── Items ── */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items</p>
            {isMultiTable ? (
              // Group items by table for merged billing
              <div className="space-y-3">
                {orders.map(order => {
                  const tLabel = order.table
                    ? `Table ${order.table.display_name?.trim() || order.table.table_number}`
                    : `Order #${order.order_number}`;
                  return (
                    <div key={order.id}>
                      <p className="text-xs font-medium text-indigo-600 mb-1">{tLabel}</p>
                      <div className="space-y-1 pl-2 border-l-2 border-indigo-100">
                        {(order.items ?? []).map((item, i) => (
                          <div key={item.id ?? i} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              <span className="font-medium">{item.quantity}×</span> {item.name}
                            </span>
                            <span className="text-gray-500 flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {allItems.map((item, i) => (
                  <div key={item.id ?? i} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="font-medium">{item.quantity}×</span> {item.name}
                    </span>
                    <span className="text-gray-500 flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-4 border-t my-2" />

          {/* ── Subtotal + Tax ── */}
          {bill && (
            <div className="px-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(bill.subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Discount</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDiscountMode(m => m === 'flat' ? 'percentage' : 'flat')}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
                    title={discountMode === 'flat' ? 'Switch to %' : 'Switch to ₹'}
                  >
                    {discountMode === 'flat'
                      ? <IndianRupee className="w-3.5 h-3.5" />
                      : <Percent className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="w-20 text-right text-sm border rounded-md px-2 py-1 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <div className="flex items-center gap-2">
                    <span>Discount applied</span>
                    <button
                      onClick={() => setDiscountBeforeTax(v => !v)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
                    >
                      {discountBeforeTax ? 'before tax' : 'after tax'}
                    </button>
                  </div>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}

              {discountBeforeTax && discountAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Taxable amount</span>
                  <span>{formatPrice(discountedSubtotal)}</span>
                </div>
              )}

              {bill.service_charge_amount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Service Charge ({bill.service_charge_percent}%)</span>
                  <span>{formatPrice(bill.service_charge_amount)}</span>
                </div>
              )}

              {bill.tax_lines.map((tl, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>CGST @{tl.cgst_rate}%</span>
                    <span>{formatPrice(discountBeforeTax && discountAmount > 0
                      ? r2(tl.cgst_amount * (discountedSubtotal / bill.subtotal))
                      : tl.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>SGST @{tl.sgst_rate}%</span>
                    <span>{formatPrice(discountBeforeTax && discountAmount > 0
                      ? r2(tl.sgst_amount * (discountedSubtotal / bill.subtotal))
                      : tl.sgst_amount)}</span>
                  </div>
                </div>
              ))}

              {roundOff !== 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Round off</span>
                  <span>{roundOff > 0 ? '+' : ''}{formatPrice(roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t">
                <span className="text-base font-bold">Grand Total</span>
                <span className="text-xl font-bold">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          )}

          <div className="mx-4 border-t my-3" />

          {/* ── Payment Method ── */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</p>
              <button
                onClick={() => setIsSplit(v => !v)}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors',
                  isSplit
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                )}
              >
                <SplitSquareHorizontal className="w-3 h-3" />
                Split
              </button>
            </div>

            {!isSplit ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map(({ value, label, icon: Icon, color, selected }) => (
                    <button
                      key={value}
                      onClick={() => { setPayMethod(value); setCashReceived(''); }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all font-semibold text-sm',
                        payMethod === value ? selected : color,
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Cash received input */}
                {payMethod === 'cash' && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-green-800 font-medium">Received</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-green-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={cashReceived}
                          onChange={e => setCashReceived(e.target.value)}
                          placeholder={String(grandTotal)}
                          className="w-24 text-right text-sm border border-green-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-green-400"
                        />
                      </div>
                    </div>
                    {cashChange > 0 && (
                      <div className="flex items-center justify-between text-sm font-bold text-green-700">
                        <span>Return</span>
                        <span>{formatPrice(cashChange)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Split payment rows */
              <div className="space-y-2">
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.method}
                      onChange={e => {
                        const next = [...splitRows];
                        next[idx] = { ...next[idx], method: e.target.value as PaymentMethod };
                        setSplitRows(next);
                      }}
                      className="text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                    <div className="flex items-center flex-1 gap-1">
                      <span className="text-sm text-gray-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={row.amount}
                        onChange={e => {
                          const next = [...splitRows];
                          next[idx] = { ...next[idx], amount: e.target.value };
                          setSplitRows(next);
                        }}
                        placeholder="0"
                        className="flex-1 text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                ))}
                <div className={cn(
                  'text-xs font-medium text-right',
                  Math.abs(splitRemaining) < 1 ? 'text-green-600' : 'text-red-500',
                )}>
                  {Math.abs(splitRemaining) < 1
                    ? 'Balanced'
                    : splitRemaining > 0
                      ? `Remaining: ${formatPrice(splitRemaining)}`
                      : `Over by: ${formatPrice(Math.abs(splitRemaining))}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: Confirm ── */}
        <SheetFooter className="border-t bg-gray-50 p-4 flex-shrink-0">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : `Collect ${formatPrice(grandTotal)}`}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
