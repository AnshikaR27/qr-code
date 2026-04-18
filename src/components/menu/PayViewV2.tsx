'use client';

import { CreditCard } from 'lucide-react';
import { formatPrice, cdnImg } from '@/lib/utils';
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

  const heroUrl = restaurant.hero_image_url ?? null;

  const tableName = (() => {
    if (!tableDisplayName) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableDisplayName)) {
      return null;
    }
    return tableDisplayName;
  })();

  const primary = restaurant.design_tokens?.['--primary'] ?? '#361f1a';
  const accent = restaurant.design_tokens?.['--accent'] ?? '#b12d00';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--sunday-bg, #fdf9f0)' }}>
      {/* Hero image */}
      <div className="w-full h-[30vh] relative overflow-hidden">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnImg(heroUrl, 960)!}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${primary}22, ${accent}44)` }}
          />
        )}
      </div>

      {/* Logo overlapping */}
      <div className="flex justify-center -mt-[55px] relative z-10">
        <div
          className="w-[110px] h-[110px] rounded-full shadow-lg flex items-center justify-center overflow-hidden border-4 border-white"
          style={{ backgroundColor: 'var(--sunday-card-bg, #FFFFFF)' }}
        >
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cdnImg(restaurant.logo_url, 180)!}
              alt={restaurant.name}
              className="w-[90px] h-[90px] rounded-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl font-extrabold" style={{ color: 'var(--sunday-accent, #b12d00)' }}>
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Table info */}
      {tableName && (
        <p className="font-body text-sm text-center mt-3" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
          Table {tableName}
        </p>
      )}

      {/* Left to pay */}
      <div className="flex items-center justify-between px-5 mt-5 mb-6">
        <span className="font-display text-2xl font-extrabold" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
          Left to pay
        </span>
        <span className="font-display text-2xl font-extrabold" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
          ₹{total.toFixed(2)}
        </span>
      </div>

      {/* Item list (view-only) */}
      <div className="px-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-center py-8" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
            Place an order from the menu to see your bill here
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm w-6 text-center" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                    {item.quantity}
                  </span>
                  <span className="font-body text-sm" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                    {item.name}
                  </span>
                </div>
                <span className="font-body text-sm" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
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
            style={{ background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }}
          >
            <CreditCard size={18} strokeWidth={2} />
            Pay or split bill
          </button>
        </div>
      )}
    </div>
  );
}
