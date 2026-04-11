'use client';

import { useState } from 'react';
import { Banknote, Smartphone, CreditCard, X } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import type { Order, PaymentMethod } from '@/types';

const METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'cash', label: 'Cash',  icon: Banknote,    color: 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'upi',  label: 'UPI',   icon: Smartphone,  color: 'border-purple-400 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { value: 'card', label: 'Card',  icon: CreditCard,  color: 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100' },
];

interface Props {
  order: Order | null;
  onConfirm: (order: Order, method: PaymentMethod) => void;
  onClose: () => void;
}

export default function PaymentDialog({ order, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  if (!order) return null;

  function handleConfirm() {
    if (!selected || !order) return;
    onConfirm(order, selected);
    setSelected(null);
  }

  function handleClose() {
    setSelected(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-bold text-lg">Record Payment</p>
            <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Total */}
        <div className="px-5 py-4 text-center border-b bg-gray-50">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold mt-1">{formatPrice(order.total)}</p>
        </div>

        {/* Payment method buttons */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm font-medium text-gray-600">Payment Method</p>
          <div className="grid grid-cols-3 gap-3">
            {METHODS.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold text-sm',
                  selected === value
                    ? color + ' ring-2 ring-offset-1 ring-current scale-[1.02]'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                <Icon className="w-6 h-6" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Confirm */}
        <div className="px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
