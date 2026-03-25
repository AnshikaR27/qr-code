'use client';

import { useState, useEffect } from 'react';
import chroma from 'chroma-js';
import { useCart } from '@/hooks/useCart';
import type { BrandPalette } from '@/lib/palette';
import type { Product } from '@/types';

function VegBadge({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#0F8A00' : '#E23744';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product | null;
  palette: BrandPalette;
  isBestseller?: boolean;
  onClose: () => void;
}

export default function DishDetailSheet({ product, palette, isBestseller, onClose }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const [localQty, setLocalQty] = useState(1);

  // Reset qty when dish changes
  useEffect(() => {
    setLocalQty(1);
  }, [product?.id]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  if (!product) return null;

  const dish = product;
  const cartItem = items.find((i) => i.product_id === dish.id);
  const cartQty = cartItem?.quantity ?? 0;
  const neonShadow = chroma(palette.neon).alpha(0.3).css();

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
        {/* Sheet — ONLY translateY animation, flex handles centering */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: palette.cardBg,
            borderRadius: '24px 24px 0 0',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
            animation: 'sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px auto 8px' }}>
            <div
              style={{
                width: 40,
                height: 5,
                borderRadius: 3,
                backgroundColor: palette.light,
              }}
            />
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 32px' }}>
            {/* 1. Photo */}
            {product.image_url && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              <VegBadge isVeg={product.is_veg} />
              {isBestseller && (
                <span
                  style={{
                    backgroundColor: palette.complement,
                    color: '#fff',
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
                    backgroundColor: palette.lightest,
                    color: palette.base,
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
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 700,
                color: palette.dark,
                lineHeight: 1.2,
              }}
            >
              {product.name}
            </div>

            {/* 4. Hindi name */}
            {product.name_hindi && (
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: palette.midLight,
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
                  fontFamily: 'var(--font-sans)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: palette.dark,
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
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 400,
                  color: palette.midDark,
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
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: palette.midDark,
                    backgroundColor: palette.lightest,
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

            {/* 8. Divider */}
            <div
              style={{
                height: 1,
                backgroundColor: palette.light,
                margin: '20px 0',
              }}
            />

            {/* 9. Action row */}
            {product.is_available ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Qty control */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: `1.5px solid ${palette.light}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: palette.pageBg,
                  }}
                >
                  <button
                    onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                    style={{
                      width: 48,
                      height: 48,
                      background: 'transparent',
                      border: 'none',
                      color: palette.midDark,
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
                      fontFamily: 'var(--font-sans)',
                      fontSize: 18,
                      fontWeight: 800,
                      color: palette.dark,
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
                      color: palette.midDark,
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

                {/* Add to order button */}
                <button
                  onClick={handleAddToOrder}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 14,
                    background: palette.ctaGradient,
                    color: palette.neonText,
                    fontFamily: 'var(--font-sans)',
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
                  color: '#E23744',
                  fontFamily: 'var(--font-sans)',
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
