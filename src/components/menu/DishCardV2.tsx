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
  tokens,
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
  const vegColor = dish.is_veg ? tokens.veg : tokens.nonveg;

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
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 16px 18px',
          cursor: dish.is_available ? 'pointer' : 'default',
          borderBottom: `1px solid ${tokens.border}`,
          backgroundColor: tokens.cardBg,
        }}
      >
        {/* Left: text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Veg/non-veg + badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: vegColor,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 11,
                color: tokens.textMuted,
                fontWeight: 500,
              }}
            >
              {dish.is_available ? (dish.is_veg ? 'Veg' : 'Non-veg') : 'Sold out'}
            </span>
            {isBestseller && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.badgeText,
                  backgroundColor: tokens.badgeBg,
                  borderRadius: 3,
                  padding: '1px 5px',
                  marginLeft: 2,
                }}
              >
                🔥 Popular
              </span>
            )}
            {dish.is_jain && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.primary,
                  backgroundColor: tokens.surfaceLow,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                JAIN
              </span>
            )}
          </div>

          {/* Dish name */}
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: 16,
              fontWeight: 700,
              color: tokens.text,
              lineHeight: 1.3,
              marginBottom: 4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            } as React.CSSProperties}
          >
            {primaryName}
          </div>

          {/* Price */}
          {dish.is_available ? (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 14,
                fontWeight: 700,
                color: tokens.text,
                marginBottom: 5,
              }}
            >
              ₹{dish.price}
              {dish.spice_level > 0 && (
                <span style={{ marginLeft: 4, fontSize: 12 }}>
                  {'🌶️'.repeat(dish.spice_level)}
                </span>
              )}
            </div>
          ) : (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 13,
                fontWeight: 700,
                color: tokens.error,
                marginBottom: 5,
              }}
            >
              Sold out
            </div>
          )}

          {/* Description */}
          {dish.description && (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 400,
                color: tokens.textMuted,
                lineHeight: 1.55,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {dish.description}
            </div>
          )}
        </div>

        {/* Right: image + add/stepper */}
        <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
          {/* Image */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: dish.image_url ? undefined : `${tokens.primary}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
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
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            ) : (
              <Utensils size={24} color={tokens.primary} strokeWidth={1.5} />
            )}
          </div>

          {/* + button or qty stepper, overlaid at bottom-right of image */}
          {dish.is_available && (
            <div
              style={{ position: 'absolute', bottom: -10, right: -6 }}
              onClick={(e) => e.stopPropagation()}
            >
              {qty === 0 ? (
                <button
                  onClick={handleAdd}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    backgroundColor: tokens.primary,
                    color: '#fff',
                    border: `2px solid ${tokens.cardBg}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    lineHeight: 1,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  }}
                >
                  +
                </button>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: tokens.cardBg,
                    borderRadius: 20,
                    border: `1.5px solid ${tokens.primary}`,
                    padding: '2px 3px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  <button
                    onClick={handleDecrease}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      color: tokens.primary,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: 13,
                      fontWeight: 700,
                      color: tokens.text,
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={handleIncrease}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      color: tokens.primary,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
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
    </div>
  );
}
