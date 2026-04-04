'use client';

import { useState, useEffect } from 'react';
import { X, List, Users, Minus, Plus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';

interface Props {
  open: boolean;
  onClose: () => void;
}

type SplitMode = 'select' | 'items' | 'equal';

export default function SplitBillSheet({ open, onClose }: Props) {
  const { items, getTotal } = useCart();
  const total = getTotal();
  const [mode, setMode] = useState<SplitMode>('select');

  // Equal split state
  const [payingFor, setPayingFor] = useState(1);
  const [totalPeople, setTotalPeople] = useState(2);

  // Item selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (open) {
      setMode('select');
      setPayingFor(1);
      setTotalPeople(2);
      setSelectedItems(new Set());
    }
  }, [open]);

  if (!open) return null;

  const selectedTotal = items
    .filter((i) => selectedItems.has(i.product_id))
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const splitAmount = totalPeople > 0 ? Math.ceil((total * payingFor) / totalPeople) : total;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] max-h-[85vh] bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-4px_40px_rgba(0,0,0,0.2)] sunday-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0 border-b border-gray-100">
          {mode !== 'select' ? (
            <button
              onClick={() => setMode('select')}
              className="text-sm font-body font-semibold text-[#1A1A1A] bg-transparent border-none cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div className="w-10" />
          )}
          <span className="font-body text-base font-bold text-[#1A1A1A]">
            {mode === 'select' ? 'Split the bill' : mode === 'items' ? 'Pay for your items' : 'Split equally'}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-none bg-gray-100 text-[#1A1A1A] cursor-pointer flex items-center justify-center"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'select' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('items')}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-white font-body text-base font-semibold border-none cursor-pointer" style={{ backgroundColor: 'var(--sunday-accent)' }}
              >
                <List size={20} />
                Pay for your items
              </button>
              <button
                onClick={() => setMode('equal')}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-white font-body text-base font-semibold border-none cursor-pointer" style={{ backgroundColor: 'var(--sunday-accent)' }}
              >
                <Users size={20} />
                Divide the bill equally
              </button>
            </div>
          )}

          {mode === 'items' && (
            <div>
              <button
                onClick={() => {
                  if (selectedItems.size === items.length) {
                    setSelectedItems(new Set());
                  } else {
                    setSelectedItems(new Set(items.map((i) => i.product_id)));
                  }
                }}
                className="font-body text-sm font-semibold text-[#1A1A1A] bg-transparent border-none cursor-pointer underline mb-4"
              >
                {selectedItems.size === items.length ? 'Deselect all' : 'Select all'}
              </button>

              <div className="space-y-2">
                {items.map((item) => {
                  const selected = selectedItems.has(item.product_id);
                  return (
                    <button
                      key={item.product_id}
                      onClick={() => {
                        const next = new Set(selectedItems);
                        if (selected) next.delete(item.product_id);
                        else next.add(item.product_id);
                        setSelectedItems(next);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        selected ? 'border-[#1A1A1A] bg-gray-50' : 'border-gray-100 bg-white'
                      } cursor-pointer text-left`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          selected ? '' : 'border-gray-300 bg-transparent'
                        }`}
                        style={selected ? { backgroundColor: 'var(--sunday-accent)', borderColor: 'var(--sunday-accent)' } : undefined}
                      >
                        {selected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-body text-sm font-medium text-[#1A1A1A]">
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                      <span className="font-body text-sm text-[#1A1A1A] shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Total + confirm */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-body text-base font-semibold text-[#1A1A1A]">Total</span>
                  <span className="font-body text-base font-bold text-[#1A1A1A]">{formatPrice(selectedTotal)}</span>
                </div>
                <button
                  onClick={onClose}
                  disabled={selectedItems.size === 0}
                  className="w-full py-4 rounded-full text-white font-body text-base font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--sunday-accent)' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {mode === 'equal' && (
            <div className="flex flex-col items-center pt-4">
              {/* Progress ring placeholder */}
              <div className="w-40 h-40 rounded-full border-4 flex items-center justify-center mb-8" style={{ borderColor: 'var(--sunday-accent)' }}>
                <span className="font-display text-2xl font-bold text-[#1A1A1A]">
                  {formatPrice(total)}
                </span>
              </div>

              {/* Paying for N people */}
              <div className="flex items-center gap-3 mb-4">
                <span className="font-body text-sm text-[#666]">Paying for</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPayingFor((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-body text-base font-bold text-[#1A1A1A] min-w-[24px] text-center">
                    {payingFor}
                  </span>
                  <button
                    onClick={() => setPayingFor((v) => Math.min(v + 1, totalPeople))}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="font-body text-sm text-[#666]">people</span>
              </div>

              {/* Out of N at the table */}
              <div className="flex items-center gap-3 mb-8">
                <span className="font-body text-sm text-[#666]">Out of</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTotalPeople((v) => Math.max(2, v - 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-body text-base font-bold text-[#1A1A1A] min-w-[24px] text-center">
                    {totalPeople}
                  </span>
                  <button
                    onClick={() => setTotalPeople((v) => v + 1)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="font-body text-sm text-[#666]">at the table</span>
              </div>

              {/* Split total */}
              <div className="text-center mb-6">
                <span className="font-body text-sm text-[#666]">Total</span>
                <p className="font-display text-2xl font-bold text-[#1A1A1A] mt-1">
                  {formatPrice(splitAmount)}
                </p>
              </div>

              {/* Confirm */}
              <button
                onClick={onClose}
                className="w-full py-4 rounded-full text-white font-body text-base font-bold border-none cursor-pointer" style={{ backgroundColor: 'var(--sunday-accent)' }}
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
