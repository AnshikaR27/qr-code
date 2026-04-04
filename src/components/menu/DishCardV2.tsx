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
        className={`flex items-start gap-4 py-5 px-4 border-b ${dish.is_available ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ borderColor: 'var(--sunday-border, #E8D5B0)' }}
      >
        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          {/* Orderable indicator */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="w-[7px] h-[7px] rounded-full shrink-0 inline-block"
              style={{ backgroundColor: dish.is_available ? '#0F8A00' : '#E23744' }}
            />
            <span className="font-body text-xs" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
              {dish.is_available ? 'Orderable' : 'Sold out'}
            </span>
          </div>

          {/* Dish name */}
          <h3
            className="font-body text-base font-semibold leading-tight mb-1 line-clamp-2"
            style={{ color: 'var(--sunday-text, #1c1c17)' }}
          >
            {primaryName}
          </h3>

          {/* Price */}
          {dish.is_available ? (
            <p className="font-body text-[15px] font-medium mb-1.5" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
              ₹{dish.price}
            </p>
          ) : (
            <p className="font-body text-[13px] font-bold text-red-500 mb-1.5">
              Sold out
            </p>
          )}

          {/* Description */}
          {dish.description && (
            <p className="font-body text-[13px] leading-relaxed line-clamp-2" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
              {dish.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {dish.is_veg && (
              <span
                className="font-body text-[11px] font-medium rounded-full px-2.5 py-0.5"
                style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
              >
                Veg
              </span>
            )}
            {isBestseller && (
              <span
                className="font-body text-[11px] font-medium rounded-full px-2.5 py-0.5"
                style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
              >
                Popular
              </span>
            )}
            {dish.is_jain && (
              <span
                className="font-body text-[11px] font-medium rounded-full px-2.5 py-0.5"
                style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
              >
                Jain
              </span>
            )}
          </div>
        </div>

        {/* Right: image + add button */}
        <div className="relative shrink-0 mt-0.5">
          <div
            className="w-[100px] h-[100px] rounded-lg overflow-hidden flex items-center justify-center select-none"
            style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)' }}
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
              <Utensils size={24} strokeWidth={1.5} style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
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
                  className="w-8 h-8 rounded-full text-white border-2 border-white cursor-pointer flex items-center justify-center text-lg leading-none shadow-md"
                  style={{ background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }}
                >
                  +
                </button>
              ) : (
                <div
                  className="flex items-center rounded-full px-1 py-0.5 shadow-md"
                  style={{
                    backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                    border: '1px solid var(--sunday-accent, #b12d00)',
                  }}
                >
                  <button
                    onClick={handleDecrease}
                    className="w-6 h-6 rounded-full bg-transparent border-none text-base font-semibold cursor-pointer flex items-center justify-center leading-none"
                    style={{ color: 'var(--sunday-text, #1c1c17)' }}
                  >
                    −
                  </button>
                  <span
                    className="font-body text-[13px] font-bold min-w-[16px] text-center"
                    style={{ color: 'var(--sunday-text, #1c1c17)' }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={handleIncrease}
                    className="w-6 h-6 rounded-full bg-transparent border-none text-base font-semibold cursor-pointer flex items-center justify-center leading-none"
                    style={{ color: 'var(--sunday-text, #1c1c17)' }}
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
