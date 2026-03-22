'use client';

import Image from 'next/image';
import { Plus, Minus } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

interface Props {
  product: Product;
  isPopular: boolean;
  primaryColor: string;
}

/* Indian standard veg/non-veg square symbol */
function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16a34a' : '#dc2626';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="8" cy="8" r="4" fill={color} />
    </svg>
  );
}

/* Qty stepper — Swiggy style: outlined border, colored text + icons */
function QtyControl({ qty, onAdd, onRemove, primaryColor }: {
  qty: number; onAdd: () => void; onRemove: () => void; primaryColor: string;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden border-2"
      style={{ borderColor: primaryColor }}
    >
      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center active:opacity-60 transition-opacity"
        style={{ color: primaryColor }}
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
      <span
        className="w-7 text-center text-sm font-black"
        style={{ color: primaryColor }}
      >
        {qty}
      </span>
      <button
        onClick={onAdd}
        className="w-8 h-8 flex items-center justify-center text-white active:opacity-60 transition-opacity"
        style={{ backgroundColor: primaryColor }}
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}

export default function DishCard({ product, isPopular, primaryColor }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const hasImage = !!product.image_url;

  return (
    <div
      className={cn(
        'bg-white border-b border-gray-100 px-4 py-4',
        !product.is_available && 'opacity-50',
      )}
    >
      <div className="flex gap-3">
        {/* Left: all text content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Veg/non-veg dot */}
          <VegDot isVeg={product.is_veg} />

          {/* Bestseller badge */}
          {isPopular && (
            <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
              ★ Bestseller
            </span>
          )}

          {/* Jain badge */}
          {product.is_jain && (
            <span className="text-[11px] font-bold text-emerald-700">✦ Jain</span>
          )}

          {/* Name */}
          <p className="text-[15px] font-bold text-gray-900 leading-snug">{product.name}</p>
          {product.name_hindi && (
            <p className="text-[12px] text-gray-400 font-medium">{product.name_hindi}</p>
          )}

          {/* Price */}
          <p className="text-[15px] font-bold text-gray-900 mt-0.5">
            {formatPrice(product.price)}
          </p>

          {/* Description */}
          {product.description && (
            <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 mt-0.5">
              {product.description}
            </p>
          )}

          {/* Spice level */}
          {product.spice_level > 0 && (
            <p className="text-[12px] text-gray-400">
              {'🌶️'.repeat(product.spice_level)}
            </p>
          )}

          {!product.is_available && (
            <span className="text-[11px] font-bold text-red-500 mt-1">Not available</span>
          )}
        </div>

        {/* Right: image + ADD button */}
        {hasImage && (
          <div className="flex flex-col items-center gap-2.5 flex-shrink-0">
            <div className="relative w-[118px] h-[118px] rounded-2xl overflow-hidden bg-gray-100">
              <Image
                src={product.image_url!}
                alt={product.name}
                fill
                className="object-cover"
                sizes="118px"
              />
            </div>

            {product.is_available && (
              <div className="-mt-5 z-10">
                {qty === 0 ? (
                  <button
                    onClick={() => addItem(product)}
                    className="px-7 py-1.5 rounded-lg bg-white text-sm font-black border-2 transition-all active:scale-95 shadow-sm"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    ADD
                  </button>
                ) : (
                  <div className="shadow-sm">
                    <QtyControl
                      qty={qty}
                      onAdd={() => addItem(product)}
                      onRemove={() => updateQuantity(product.id, qty - 1)}
                      primaryColor={primaryColor}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD button for no-image cards — sits at bottom right */}
      {!hasImage && product.is_available && (
        <div className="flex justify-end mt-3">
          {qty === 0 ? (
            <button
              onClick={() => addItem(product)}
              className="px-7 py-1.5 rounded-lg bg-white text-sm font-black border-2 transition-all active:scale-95"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              ADD
            </button>
          ) : (
            <QtyControl
              qty={qty}
              onAdd={() => addItem(product)}
              onRemove={() => updateQuantity(product.id, qty - 1)}
              primaryColor={primaryColor}
            />
          )}
        </div>
      )}
    </div>
  );
}
