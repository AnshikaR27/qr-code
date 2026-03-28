'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

function VegBadge({ isVeg, veg, nonveg }: { isVeg: boolean; veg: string; nonveg: string }) {
  const color = isVeg ? veg : nonveg;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product | null;
  tokens: MenuTokens;
  isBestseller?: boolean;
  onClose: () => void;
}

export default function DishDetailSheet({ product, tokens, isBestseller, onClose }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const reduced = useReducedMotion();
  const [localQty, setLocalQty] = useState(1);

  // ── Hero parallax ────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgOffset, setImgOffset] = useState(0);

  const handleSheetScroll = useCallback(() => {
    if (!scrollRef.current || reduced) return;
    setImgOffset(Math.min(scrollRef.current.scrollTop * 0.3, 18));
  }, [reduced]);

  useEffect(() => {
    setLocalQty(1);
    setImgOffset(0);
  }, [product?.id]);

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  if (!product) return null;

  const dish = product;
  const cartItem = items.find((i) => i.product_id === dish.id);
  const cartQty = cartItem?.quantity ?? 0;
  const neonShadow = `${tokens.accent}4d`;

  function handleAddToOrder() {
    if (cartQty === 0) {
      for (let i = 0; i < localQty; i++) addItem(dish);
    } else {
      updateQuantity(dish.id, cartQty + localQty);
    }
    onClose();
  }

  return (
    <>
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          ref={scrollRef}
          onClick={(e) => e.stopPropagation()}
          onScroll={handleSheetScroll}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: tokens.cardBg,
            borderRadius: '24px 24px 0 0',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
            // Spring easing on open — cubic-bezier(0.34, 1.56, 0.64, 1) overshoots then settles
            animation: reduced ? 'none' : 'sheetUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px auto 8px' }}>
            <div
              style={{
                width: 40,
                height: 5,
                borderRadius: 3,
                backgroundColor: tokens.border,
              }}
            />
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 32px' }}>
            {/* 1. Photo — with hero parallax (scrolls at 0.7× speed) */}
            {product.image_url && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 16,
                  boxShadow: `0 8px 32px ${tokens.text}14`,
                  position: 'relative',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{
                    width: '100%',
                    // Extra height so parallax movement doesn't reveal edges
                    height: '115%',
                    marginTop: '-7.5%',
                    objectFit: 'cover',
                    // As user scrolls down, image moves up at 0.3× = content scrolls 1×, image 0.7×
                    transform: reduced ? 'none' : `translateY(${-imgOffset}px)`,
                    willChange: 'transform',
                    transition: 'none',
                  }}
                />
              </div>
            )}

            {/* 2. Badges row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <VegBadge isVeg={product.is_veg} veg={tokens.veg} nonveg={tokens.nonveg} />
              {isBestseller && (
                <span
                  style={{
                    backgroundColor: tokens.badgeBg,
                    color: tokens.badgeText,
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  🔥 Popular
                </span>
              )}
              {product.is_jain && (
                <span
                  style={{
                    backgroundColor: tokens.bg,
                    color: tokens.primary,
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  JAIN
                </span>
              )}
            </div>

            {/* 3. Dish name */}
            <div
              style={{
                fontFamily: tokens.fontHeading,
                fontSize: 24,
                fontWeight: 700,
                color: tokens.text,
                lineHeight: 1.2,
              }}
            >
              {product.name}
            </div>

            {/* 4. Hindi name */}
            {product.name_hindi && (
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  fontWeight: 500,
                  color: tokens.textMuted,
                  marginTop: 4,
                }}
              >
                {product.name_hindi}
              </div>
            )}

            {/* 5. Price + spice */}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 22,
                  fontWeight: 800,
                  color: tokens.text,
                }}
              >
                ₹{product.price}
              </span>
              {product.spice_level > 0 && (
                <span style={{ fontSize: 16 }}>{'🌶️'.repeat(product.spice_level)}</span>
              )}
            </div>

            {/* 6. Description */}
            {product.description && (
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  fontWeight: 400,
                  color: tokens.textMuted,
                  marginTop: 14,
                  lineHeight: 1.65,
                }}
              >
                {product.description}
              </div>
            )}

            {/* 7. Allergen tags */}
            {product.allergens && product.allergens.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 11,
                    fontWeight: 600,
                    color: tokens.textMuted,
                    backgroundColor: tokens.bg,
                    borderRadius: 50,
                    padding: '3px 10px',
                  }}
                >
                  Contains:{' '}
                  {product.allergens
                    .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
                    .join(', ')}
                </span>
              </div>
            )}

            {/* 8. Spacing instead of divider — per "No-Line" rule */}
            <div style={{ marginTop: 28 }} />

            {/* 9. Action row */}
            {product.is_available ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Qty control */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: tokens.bg,
                  }}
                >
                  <button
                    onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                    style={{
                      width: 48,
                      height: 48,
                      background: 'transparent',
                      border: 'none',
                      color: tokens.textMuted,
                      fontSize: 20,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      width: 40,
                      textAlign: 'center',
                      fontFamily: tokens.fontBody,
                      fontSize: 18,
                      fontWeight: 800,
                      color: tokens.text,
                    }}
                  >
                    {localQty}
                  </span>
                  <button
                    onClick={() => setLocalQty((q) => q + 1)}
                    style={{
                      width: 48,
                      height: 48,
                      background: 'transparent',
                      border: 'none',
                      color: tokens.textMuted,
                      fontSize: 20,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Add to order button — radius xl (24px) per DESIGN.md */}
                <button
                  onClick={handleAddToOrder}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 24,
                    background: tokens.ctaGradient,
                    color: '#fff',
                    fontFamily: tokens.fontBody,
                    fontSize: 16,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: `0 4px 20px ${neonShadow}`,
                  }}
                >
                  Add to order · ₹{product.price * localQty}
                </button>
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: tokens.error,
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '12px 0',
                }}
              >
                Sold out
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
