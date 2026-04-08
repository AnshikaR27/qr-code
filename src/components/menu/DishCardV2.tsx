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
      ([entry]) => { setRevealed(entry.isIntersecting); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  const staggerDelay = reduced ? 0 : Math.min(index, 5) * 50;

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
        transform: revealed ? 'translateY(0)' : 'translateY(20px)',
        transition: reduced
          ? 'none'
          : `opacity 400ms ease-out ${staggerDelay}ms, transform 400ms ease-out ${staggerDelay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      <div
        onClick={dish.is_available ? onTap : undefined}
        onMouseDown={dish.is_available ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; } : undefined}
        onMouseUp={dish.is_available ? (e) => { (e.currentTarget as HTMLElement).style.transform = ''; } : undefined}
        onMouseLeave={dish.is_available ? (e) => { (e.currentTarget as HTMLElement).style.transform = ''; } : undefined}
        onTouchStart={dish.is_available ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; } : undefined}
        onTouchEnd={dish.is_available ? (e) => { (e.currentTarget as HTMLElement).style.transform = ''; } : undefined}
        className={`flex items-start gap-3 min-[400px]:gap-4 p-3 min-[400px]:p-3.5 ${dish.is_available ? 'cursor-pointer' : 'cursor-default'}`}
        style={{
          borderRadius: 'var(--sunday-radius, 12px)',
          backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
          boxShadow: 'var(--sunday-shadow-md)',
          transition: 'transform 120ms ease',
          willChange: 'transform',
        }}
      >
        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          {/* Sold out badge — only for unavailable items */}
          {!dish.is_available && (
            <span className="text-[12px] font-bold text-red-500 mb-1.5 block" style={{ fontFamily: 'var(--sunday-font-body)' }}>
              Sold out
            </span>
          )}

          {/* Dish name with veg/non-veg dot inline */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: dish.is_veg ? 'var(--sunday-veg, #0F8A00)' : 'var(--sunday-nonveg, #E23744)' }}
            />
            <h3
              className="text-[14px] min-[400px]:text-[15px] font-bold leading-tight whitespace-nowrap"
              style={{ color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
            >
              {primaryName}
            </h3>
          </div>

          {/* Price */}
          <p className="text-[14px] min-[400px]:text-[15px] font-semibold mb-1 min-[400px]:mb-1.5" style={{ color: 'var(--sunday-primary, #361f1a)', fontFamily: 'var(--sunday-font-body)' }}>
            ₹{dish.price}
          </p>

          {/* Description */}
          {dish.description && (
            <p className="text-[12px] min-[400px]:text-[13px] leading-relaxed line-clamp-2" style={{ color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              {dish.description}
            </p>
          )}

          {/* Tags — badge-bg/badge-text for visual pop */}
          {(isBestseller || dish.is_jain) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {isBestseller && (
                <span
                  className="text-[12px] font-medium px-2.5 py-0.5"
                  style={{
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                    backgroundColor: 'var(--sunday-badge-bg, #C8991A)',
                    color: 'var(--sunday-badge-text, #ffffff)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                >
                  Popular
                </span>
              )}
              {dish.is_jain && (
                <span
                  className="text-[12px] font-medium px-2.5 py-0.5"
                  style={{
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                    backgroundColor: 'var(--sunday-badge-bg, #C8991A)',
                    color: 'var(--sunday-badge-text, #ffffff)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                >
                  Jain
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: image + add button */}
        <div className="relative shrink-0">
          <div
            className="w-[100px] h-[100px] min-[400px]:w-[128px] min-[400px]:h-[128px] overflow-hidden flex items-center justify-center select-none"
            style={{
              borderRadius: 'var(--sunday-radius, 12px)',
              backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
            }}
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
              className="absolute -bottom-1.5 -right-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {qty === 0 ? (
                <button
                  onClick={handleAdd}
                  className="w-9 h-9 min-[400px]:w-11 min-[400px]:h-11 rounded-full text-white border-2 border-white cursor-pointer flex items-center justify-center leading-none active:scale-90 transition-transform duration-100"
                  style={{
                    background: 'linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))',
                    boxShadow: 'var(--sunday-shadow-md)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              ) : (
                <div
                  className="flex items-center px-1 py-0.5"
                  style={{
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                    backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                    border: '1px solid var(--sunday-accent, #b12d00)',
                    boxShadow: 'var(--sunday-shadow-sm)',
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
                    className="text-[14px] font-bold min-w-[16px] text-center"
                    style={{ color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
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
