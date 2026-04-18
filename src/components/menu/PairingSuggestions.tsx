'use client';

import { Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { cdnImg } from '@/lib/utils';
import type { Product } from '@/types';

interface Props {
  suggestions: Product[];
}

export default function PairingSuggestions({ suggestions }: Props) {
  const { addItem } = useCart();

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <h4 className="text-base font-semibold mb-3 px-5" style={{ color: 'var(--sunday-text, #1A1A1A)', fontFamily: 'var(--sunday-font-heading)' }}>
        People usually pair this with
      </h4>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-5 pb-2">
        {suggestions.map((item) => (
          <div key={item.id} className="shrink-0 w-[120px]">
            <div
              className="relative w-[120px] h-[120px] overflow-hidden mb-2"
              style={{
                borderRadius: 'var(--sunday-radius, 12px)',
                backgroundColor: 'var(--sunday-surface-low, #F5F5F0)',
              }}
            >
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cdnImg(item.image_url)!}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Utensils size={24} style={{ color: 'var(--sunday-text-muted, #999)' }} strokeWidth={1.5} />
                </div>
              )}
              <button
                onClick={() => { addItem(item); navigator.vibrate?.(50); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full text-white flex items-center justify-center text-sm active:scale-90 transition-transform duration-100"
                style={{ backgroundColor: 'var(--sunday-accent)', boxShadow: 'var(--sunday-shadow-sm)' }}
              >
                +
              </button>
            </div>
            <p className="text-sm font-medium leading-tight line-clamp-2" style={{ color: 'var(--sunday-text, #1A1A1A)', fontFamily: 'var(--sunday-font-body)' }}>
              {item.name}
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--sunday-text-muted, #666)', fontFamily: 'var(--sunday-font-body)' }}>
              ₹{item.price}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
