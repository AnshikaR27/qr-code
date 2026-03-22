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

/* Indian standard veg/non-veg symbol */
function VegSymbol({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16a34a' : '#dc2626';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
      <rect x="1" y="1" width="16" height="16" rx="2.5" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

/* Chili spice indicator */
function SpiceIndicator({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[13px] leading-none">
      {Array.from({ length: level }).map((_, i) => (
        <span key={i}>🌶️</span>
      ))}
    </span>
  );
}

/* Qty stepper */
function QtyControl({
  qty, onAdd, onRemove, primaryColor, compact,
}: {
  qty: number; onAdd: () => void; onRemove: () => void; primaryColor: string; compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-full overflow-hidden animate-scale-in',
        compact ? 'h-8' : 'h-9',
      )}
      style={{
        border: `2.5px solid ${primaryColor}`,
        boxShadow: `0 2px 10px ${primaryColor}30`,
      }}
    >
      <button
        onClick={onRemove}
        className="flex items-center justify-center text-white active:opacity-70 transition-opacity"
        style={{ backgroundColor: primaryColor, width: compact ? '30px' : '36px', height: '100%' }}
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
      <span
        className={cn('font-black text-center', compact ? 'w-7 text-sm' : 'w-8 text-base')}
        style={{ color: primaryColor }}
      >
        {qty}
      </span>
      <button
        onClick={onAdd}
        className="flex items-center justify-center text-white active:opacity-70 transition-opacity"
        style={{ backgroundColor: primaryColor, width: compact ? '30px' : '36px', height: '100%' }}
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
        'relative bg-white rounded-[18px] overflow-hidden',
        'animate-fade-in-up',
        product.is_available ? 'active:scale-[0.99]' : 'opacity-60',
      )}
      style={{
        borderLeft: `4px solid ${primaryColor}`,
        boxShadow: `0 2px 16px ${primaryColor}18, 0 1px 4px rgba(0,0,0,0.06)`,
        transition: 'box-shadow 0.2s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 28px ${primaryColor}30, 0 2px 8px rgba(0,0,0,0.08)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 16px ${primaryColor}18, 0 1px 4px rgba(0,0,0,0.06)`;
      }}
    >
      {hasImage ? (
        /* ── WITH IMAGE ── */
        <div className="flex gap-0 p-4">
          {/* Left info */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 pr-3">
            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <VegSymbol isVeg={product.is_veg} />
              {isPopular && (
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full text-white tracking-wide"
                  style={{ backgroundColor: primaryColor }}
                >
                  ★ BESTSELLER
                </span>
              )}
              {product.is_jain && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 tracking-wide">
                  JAIN
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <p className="text-[15px] font-bold text-gray-900 leading-snug">{product.name}</p>
              {product.name_hindi && (
                <p className="text-xs font-medium text-gray-400 mt-0.5">{product.name_hindi}</p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
                {product.description}
              </p>
            )}

            {/* Price + spice */}
            <div className="flex items-center gap-2 mt-auto">
              <span
                className="text-[17px] font-black"
                style={{ color: primaryColor }}
              >
                {formatPrice(product.price)}
              </span>
              <SpiceIndicator level={product.spice_level} />
            </div>

            {!product.is_available && (
              <span className="text-[11px] font-bold text-red-500">Currently Unavailable</span>
            )}
          </div>

          {/* Right: image + button */}
          <div className="flex flex-col items-center gap-2.5 flex-shrink-0">
            <div
              className="relative w-[92px] h-[92px] rounded-[14px] overflow-hidden"
              style={{ boxShadow: `0 4px 12px rgba(0,0,0,0.15)` }}
            >
              <Image
                src={product.image_url!}
                alt={product.name}
                fill
                className="object-cover"
                sizes="92px"
              />
            </div>

            {product.is_available && (
              qty === 0 ? (
                <button
                  onClick={() => addItem(product)}
                  className="w-[92px] py-2.5 rounded-full text-sm font-black text-white tracking-wider transition-all duration-150 active:scale-95"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 4px 14px ${primaryColor}55`,
                  }}
                >
                  ADD
                </button>
              ) : (
                <QtyControl
                  qty={qty}
                  onAdd={() => addItem(product)}
                  onRemove={() => updateQuantity(product.id, qty - 1)}
                  primaryColor={primaryColor}
                  compact
                />
              )
            )}
          </div>
        </div>
      ) : (
        /* ── WITHOUT IMAGE (intentionally minimal) ── */
        <div className="p-4">
          {/* Top row */}
          <div className="flex items-start gap-2 mb-2">
            <VegSymbol isVeg={product.is_veg} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-1.5">
                <span className="text-[15px] font-bold text-gray-900 leading-snug">{product.name}</span>
                {isPopular && (
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full text-white tracking-wide mt-0.5"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ★ BESTSELLER
                  </span>
                )}
                {product.is_jain && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 tracking-wide mt-0.5">
                    JAIN
                  </span>
                )}
              </div>
              {product.name_hindi && (
                <p className="text-xs font-medium text-gray-400 mt-0.5">{product.name_hindi}</p>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 mb-3 pl-[26px]">
              {product.description}
            </p>
          )}

          {/* Bottom: price + add */}
          <div className="flex items-center justify-between pl-[26px]">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-black" style={{ color: primaryColor }}>
                {formatPrice(product.price)}
              </span>
              <SpiceIndicator level={product.spice_level} />
              {!product.is_available && (
                <span className="text-[11px] font-bold text-red-500">Unavailable</span>
              )}
            </div>

            {product.is_available && (
              qty === 0 ? (
                <button
                  onClick={() => addItem(product)}
                  className="px-6 py-2.5 rounded-full text-sm font-black text-white tracking-wider transition-all duration-150 active:scale-95"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 4px 14px ${primaryColor}55`,
                  }}
                >
                  ADD
                </button>
              ) : (
                <QtyControl
                  qty={qty}
                  onAdd={() => addItem(product)}
                  onRemove={() => updateQuantity(product.id, qty - 1)}
                  primaryColor={primaryColor}
                  compact
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
