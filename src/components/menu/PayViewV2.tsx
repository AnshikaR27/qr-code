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

  // Hero: use hero_image_url, fallback to first product or brand gradient
  const heroUrl = restaurant.hero_image_url ?? null;

  // Format table display name: never show raw UUID
  const tableName = (() => {
    if (!tableDisplayName) return null;
    // If it looks like a UUID (36 chars with dashes), don't show it
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableDisplayName)) {
      return null;
    }
    return tableDisplayName;
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero image */}
      <div className="w-full h-[30vh] relative overflow-hidden">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${restaurant.design_tokens?.['--primary'] ?? '#D4A373'}22, ${restaurant.design_tokens?.['--accent'] ?? '#FEFAE0'}44)`,
            }}
          />
        )}
      </div>

      {/* Logo overlapping — 110px */}
      <div className="flex justify-center -mt-[55px] relative z-10">
        <div className="w-[110px] h-[110px] rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden border-4 border-white">
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-[90px] h-[90px] rounded-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl font-bold" style={{ color: 'var(--sunday-accent)' }}>
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Table info — never show UUID */}
      {tableName && (
        <p className="font-body text-sm text-[#999] text-center mt-3">
          Table {tableName}
        </p>
      )}

      {/* Left to pay */}
      <div className="flex items-center justify-between px-5 mt-5 mb-6">
        <span className="font-display text-2xl font-bold text-[#1A1A1A]">Left to pay</span>
        <span className="font-display text-2xl font-bold text-[#1A1A1A]">
          ₹{total.toFixed(2)}
        </span>
      </div>

      {/* Item list (view-only) */}
      <div className="px-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-[#666] text-center py-8">
            Place an order from the menu to see your bill here
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
            className="w-full py-4 rounded-full text-white font-body text-base font-bold border-none cursor-pointer flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--sunday-accent)' }}
          >
            <CreditCard size={18} strokeWidth={2} />
            Pay or split bill
          </button>
        </div>
      )}
    </div>
  );
}
