'use client';

import { CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  tableDisplayName?: string | null;
  onSplitBill: () => void;
}

export default function PayViewV2({
  restaurant,
  tableDisplayName,
  onSplitBill,
}: Props) {
  const { items, getTotal } = useCart();
  const total = getTotal();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero image */}
      <div className="w-full h-[30vh] relative overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" />
      </div>

      {/* Logo overlapping */}
      <div className="flex justify-center -mt-10 relative z-10">
        <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-[#1A1A1A]">
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Table info */}
      {tableDisplayName && (
        <p className="font-body text-sm text-[#999] text-center mt-3">
          Table {tableDisplayName}
        </p>
      )}

      {/* Left to pay */}
      <div className="flex items-center justify-between px-5 mt-5 mb-6">
        <span className="font-display text-2xl font-bold text-[#1A1A1A]">Left to pay</span>
        <span className="font-display text-2xl font-bold text-[#1A1A1A]">{formatPrice(total)}</span>
      </div>

      {/* Item list (view-only) */}
      <div className="px-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-[#666] text-center py-8">
            No items ordered yet
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm text-[#666] w-6 text-center">{item.quantity}</span>
                  <span className="font-body text-sm text-[#1A1A1A]">{item.name}</span>
                </div>
                <span className="font-body text-sm text-[#1A1A1A]">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay or split bill button */}
      {items.length > 0 && (
        <div className="px-5 mt-8 pb-28">
          <button
            onClick={onSplitBill}
            className="w-full py-4 rounded-full bg-[#1A1A1A] text-white font-body text-base font-bold border-none cursor-pointer flex items-center justify-center gap-2"
          >
            <CreditCard size={18} strokeWidth={2} />
            Pay or split bill
          </button>
        </div>
      )}
    </div>
  );
}
