'use client';

import { Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

interface Props {
  suggestions: Product[];
}

export default function PairingSuggestions({ suggestions }: Props) {
  const { addItem } = useCart();

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <h4 className="font-body text-base font-semibold text-[#1A1A1A] mb-3 px-5">
        People usually pair this with
      </h4>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-5 pb-2">
        {suggestions.map((item) => (
          <div key={item.id} className="shrink-0 w-[120px]">
            <div className="relative w-[120px] h-[120px] rounded-lg overflow-hidden bg-[#F5F5F0] mb-2">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Utensils size={24} color="#999" strokeWidth={1.5} />
                </div>
              )}
              <button
                onClick={() => { addItem(item); navigator.vibrate?.(50); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm shadow-md"
              >
                +
              </button>
            </div>
            <p className="font-body text-sm font-medium text-[#1A1A1A] leading-tight line-clamp-2">
              {item.name}
            </p>
            <p className="font-body text-[13px] text-[#666] mt-0.5">
              ₹{item.price}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
