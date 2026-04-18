'use client';

import { useRef, useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatPrice, cdnImg } from '@/lib/utils';
import type { Product } from '@/types';

interface Props {
  dish: Product;
  index: number;
  isBestseller: boolean;
  lang?: 'en' | 'hi';
  onTap: () => void;
  onLongPressImage?: (url: string, name: string) => void;
  onAdd?: (dish: Product) => void;
}

const EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

export default function DishCardV2({
  dish,
  index,
  isBestseller,
  lang = 'en',
  onTap,
  onLongPressImage,
  onAdd,
}: Props) {
  const { items, addItem, updateQuantity, getProductCount } = useCart();
  const reduced = useReducedMotion();

  const outerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reduced) { setRevealed(true); return; }
    const el = outerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setRevealed(true); },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  const staggerDelay = reduced ? 0 : Math.min(index, 4) * 30;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function startLongPress() {
    if (!dish.image_url || !onLongPressImage) return;
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(40);
      onLongPressImage(dish.image_url!, dish.name);
    }, 500);
  }
  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  const qty = getProductCount(dish.id);
  const primaryName = lang === 'hi' && dish.name_hindi ? dish.name_hindi : dish.name;
  const unavailable = !dish.is_available;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (onAdd) onAdd(dish);
    else addItem(dish);
    navigator.vibrate?.(50);
  }
  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation();
    if (onAdd) onAdd(dish);
    else addItem(dish);
    navigator.vibrate?.(30);
  }
  function handleDecrease(e: React.MouseEvent) {
    e.stopPropagation();
    const productItems = items.filter((i) => i.product_id === dish.id);
    if (productItems.length === 0) return;
    const last = productItems[productItems.length - 1];
    updateQuantity(last.cart_key, last.quantity - 1);
  }

  return (
    <div
      ref={outerRef}
      style={{
        opacity: revealed ? (unavailable ? 0.42 : 1) : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: reduced
          ? 'none'
          : `opacity 280ms ${EASING} ${staggerDelay}ms, transform 280ms ${EASING} ${staggerDelay}ms`,
        willChange: revealed ? 'auto' : 'opacity, transform',
      }}
    >
      <div
        onClick={unavailable ? undefined : onTap}
        className={`flex items-start ${unavailable ? 'cursor-default' : 'cursor-pointer'}`}
        style={{
          gap: '12px',
          padding: '14px 20px',
          transition: 'transform 120ms ease-out',
          willChange: 'transform',
        }}
        onMouseDown={unavailable ? undefined : (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.99)'; }}
        onMouseUp={unavailable ? undefined : (e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        onMouseLeave={unavailable ? undefined : (e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        onTouchStart={unavailable ? undefined : (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.99)'; }}
        onTouchEnd={unavailable ? undefined : (e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        {/* Left: text */}
        <div className="flex-1 min-w-0">
          {/* Veg/non-veg indicator — framed square, not plain dot */}
          <div className="flex items-center gap-1.5 mb-2">
            <div
              style={{
                width: '12px',
                height: '12px',
                border: `1.5px solid ${dish.is_veg ? 'var(--sunday-veg, #0F8A00)' : 'var(--sunday-nonveg, #E23744)'}`,
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: dish.is_veg ? 'var(--sunday-veg, #0F8A00)' : 'var(--sunday-nonveg, #E23744)',
                }}
              />
            </div>
            {isBestseller && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--sunday-badge-bg, #C8991A)',
                  fontFamily: 'var(--sunday-font-body)',
                }}
              >
                Popular
              </span>
            )}
            {dish.is_jain && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--sunday-text-muted, #7A6040)',
                  fontFamily: 'var(--sunday-font-body)',
                }}
              >
                Jain
              </span>
            )}
            {unavailable && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--sunday-nonveg, #E23744)',
                  fontFamily: 'var(--sunday-font-body)',
                }}
              >
                Sold out
              </span>
            )}
          </div>

          <h3
            className="font-semibold line-clamp-2 m-0"
            style={{
              fontSize: '14px',
              lineHeight: 1.35,
              color: 'var(--sunday-text, #1c1c17)',
              fontFamily: 'var(--sunday-font-heading)',
              marginBottom: '4px',
            }}
          >
            {primaryName}
          </h3>

          {dish.description && (
            <p
              className="line-clamp-2 m-0"
              style={{
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--sunday-text-muted, #7A6040)',
                fontFamily: 'var(--sunday-font-body)',
                marginBottom: '6px',
              }}
            >
              {dish.description}
            </p>
          )}

          <p
            className="font-semibold m-0"
            style={{
              fontSize: '13px',
              color: 'var(--sunday-text, #1c1c17)',
              fontFamily: 'var(--sunday-font-body)',
            }}
          >
            {formatPrice(dish.price)}
          </p>
        </div>

        {/* Right: image + controls */}
        <div className="shrink-0 flex flex-col items-center" style={{ gap: '6px' }}>
          {/* Image — slightly larger, no cantilevered button */}
          <div
            className="overflow-hidden flex items-center justify-center select-none"
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '10px',
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
                src={cdnImg(dish.image_url)!}
                alt={dish.name}
                draggable={false}
                loading="lazy"
                className="w-full h-full object-cover block pointer-events-none"
              />
            ) : (
              <Utensils
                size={22}
                strokeWidth={1.5}
                style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
              />
            )}
          </div>

          {/* Add controls — below the image, not overlapping */}
          {!unavailable && (
            <div onClick={(e) => e.stopPropagation()}>
              {qty === 0 ? (
                <button
                  key="add-btn"
                  onClick={handleAdd}
                  aria-label={`Add ${primaryName} to cart`}
                  className="flex items-center justify-center border-none cursor-pointer"
                  style={{
                    width: '96px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--sunday-accent, #b12d00)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'var(--sunday-font-body)',
                    letterSpacing: '0.02em',
                    transition: 'transform 120ms ease-out',
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                  onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                  onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                >
                  Add +
                </button>
              ) : (
                <div
                  key="stepper"
                  className="flex items-center justify-between"
                  style={{
                    width: '96px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1.5px solid var(--sunday-accent, #b12d00)',
                    backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                    padding: '0 4px',
                  }}
                >
                  <button
                    onClick={handleDecrease}
                    aria-label={`Remove one ${primaryName}`}
                    className="w-6 h-6 rounded-full bg-transparent border-none cursor-pointer flex items-center justify-center font-semibold"
                    style={{
                      fontSize: '16px',
                      lineHeight: 1,
                      color: 'var(--sunday-text, #1c1c17)',
                    }}
                  >
                    −
                  </button>
                  <span
                    className="font-bold text-center"
                    style={{
                      fontSize: '13px',
                      minWidth: '18px',
                      color: 'var(--sunday-text, #1c1c17)',
                      fontFamily: 'var(--sunday-font-body)',
                    }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={handleIncrease}
                    aria-label={`Add another ${primaryName}`}
                    className="w-6 h-6 rounded-full bg-transparent border-none cursor-pointer flex items-center justify-center font-semibold"
                    style={{
                      fontSize: '16px',
                      lineHeight: 1,
                      color: 'var(--sunday-accent, #b12d00)',
                    }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hairline divider — replaces the card box shadow */}
      <div
        style={{
          height: '1px',
          marginLeft: '20px',
          backgroundColor:
            'color-mix(in srgb, var(--sunday-border, #E8D5B0) 55%, transparent)',
        }}
      />
    </div>
  );
}
