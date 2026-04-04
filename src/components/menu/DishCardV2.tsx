'use client';

import { useRef, useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

interface Props {
  dish: Product;
  tokens: MenuTokens;
  index: number;
  isBestseller: boolean;
  lang?: 'en' | 'hi';
  onTap: () => void;
  onLongPressImage?: (url: string, name: string) => void;
}

export default function DishCardV2({
  dish,
  index,
  isBestseller,
  lang = 'en',
  onTap,
  onLongPressImage,
}: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const reduced = useReducedMotion();

  const outerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reduced) { setRevealed(true); return; }
    const el = outerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); obs.unobserve(el); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  const staggerDelay = reduced ? 0 : Math.min(index, 5) * 40;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress() {
    if (!dish.image_url || !onLongPressImage) return;
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(40);
      onLongPressImage(dish.image_url!, dish.name);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const cartItem = items.find((i) => i.product_id === dish.id);
  const qty = cartItem?.quantity ?? 0;
  const primaryName = (lang === 'hi' && dish.name_hindi) ? dish.name_hindi : dish.name;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    addItem(dish);
    navigator.vibrate?.(50);
  }

  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty + 1);
    navigator.vibrate?.(30);
  }

  function handleDecrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty - 1);
  }

  return (
    <div
      ref={outerRef}
      style={{
        opacity: revealed ? (dish.is_available ? 1 : 0.45) : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(10px)',
        transition: reduced
          ? 'none'
          : `opacity 300ms ease-out ${staggerDelay}ms, transform 300ms ease-out ${staggerDelay}ms`,
      }}
    >
      <div
        onClick={dish.is_available ? onTap : undefined}
        className={`flex items-start gap-4 py-5 px-4 ${dish.is_available ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Left: text content (70%) */}
        <div className="flex-1 min-w-0">
          {/* Orderable badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-[7px] h-[7px] rounded-full bg-green-600 shrink-0 inline-block" />
            <span className="font-body text-xs text-[#666]">
              {dish.is_available ? 'Orderable' : 'Sold out'}
            </span>
          </div>

          {/* Dish name */}
          <h3 className="font-body text-base font-semibold text-[#1A1A1A] leading-tight mb-1 line-clamp-2">
            {primaryName}
          </h3>

          {/* Price */}
          {dish.is_available ? (
            <p className="font-body text-[15px] font-medium text-[#1A1A1A] mb-1.5">
              ₹{dish.price}
            </p>
          ) : (
            <p className="font-body text-[13px] font-bold text-red-500 mb-1.5">
              Sold out
            </p>
          )}

          {/* Description */}
          {dish.description && (
            <p className="font-body text-[13px] text-[#888] leading-relaxed line-clamp-2">
              {dish.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 mt-2">
            {dish.is_veg && (
              <span className="font-body text-[11px] font-medium text-[#666] bg-[#F5F5F0] rounded-full px-2.5 py-0.5">
                Veg
              </span>
            )}
            {isBestseller && (
              <span className="font-body text-[11px] font-medium text-[#666] bg-[#F5F5F0] rounded-full px-2.5 py-0.5">
                Popular
              </span>
            )}
            {dish.is_jain && (
              <span className="font-body text-[11px] font-medium text-[#666] bg-[#F5F5F0] rounded-full px-2.5 py-0.5">
                Jain
              </span>
            )}
          </div>
        </div>

        {/* Right: image + add button (30%) */}
        <div className="relative shrink-0 mt-0.5">
          <div
            className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-[#F5F5F0] flex items-center justify-center select-none"
            onTouchStart={(e) => { e.stopPropagation(); startLongPress(); }}
            onTouchEnd={(e) => { e.stopPropagation(); cancelLongPress(); }}
            onTouchMove={cancelLongPress}
            onMouseDown={(e) => { e.stopPropagation(); startLongPress(); }}
            onMouseUp={(e) => { e.stopPropagation(); cancelLongPress(); }}
            onMouseLeave={cancelLongPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            {dish.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dish.image_url}
                alt={dish.name}
                draggable={false}
                className="w-full h-full object-cover block pointer-events-none"
              />
            ) : (
              <Utensils size={24} color="#999" strokeWidth={1.5} />
            )}
          </div>

          {/* + button or qty stepper */}
          {dish.is_available && (
            <div
              className="absolute -bottom-2.5 -right-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {qty === 0 ? (
                <button
                  onClick={handleAdd}
                  className="w-8 h-8 rounded-full text-white border-2 border-white cursor-pointer flex items-center justify-center text-lg leading-none shadow-md active:sunday-btn-pulse"
                  style={{ backgroundColor: 'var(--sunday-accent)' }}
                >
                  +
                </button>
              ) : (
                <div className="flex items-center bg-white rounded-full px-1 py-0.5 shadow-md" style={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--sunday-accent)' }}>
                  <button
                    onClick={handleDecrease}
                    className="w-6 h-6 rounded-full bg-transparent border-none text-[#1A1A1A] text-base font-semibold cursor-pointer flex items-center justify-center leading-none"
                  >
                    −
                  </button>
                  <span className="font-body text-[13px] font-bold text-[#1A1A1A] min-w-[16px] text-center">
                    {qty}
                  </span>
                  <button
                    onClick={handleIncrease}
                    className="w-6 h-6 rounded-full bg-transparent border-none text-[#1A1A1A] text-base font-semibold cursor-pointer flex items-center justify-center leading-none"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
