'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import { formatPrice, getContrastText } from '@/lib/utils';
import type { Product } from '@/types';

function VegBadge({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#0F8A00' : '#E23744';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="16" height="16" rx="2.5" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product | null;
  rank: 1 | 2 | 3 | null;
  primaryColor: string;
  onClose: () => void;
}

export default function DishDetailSheet({ product, rank, primaryColor, onClose }: Props) {
  const { items, addItem, updateQuantity } = useCart();

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  if (!product) return null;

  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const addBtnText = getContrastText(primaryColor);

  // Compute rgba for shadow
  const hex = primaryColor.startsWith('#') ? primaryColor.slice(1) : primaryColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

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
        {/* Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: '#FFFFFF',
            borderRadius: '20px 20px 0 0',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
            animation: 'sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 4, backgroundColor: '#E0E0E0' }} />
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 28px' }}>
            {/* Photo */}
            {product.image_url && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  borderRadius: 14,
                  overflow: 'hidden',
                  marginBottom: 16,
                  position: 'relative',
                }}
              >
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="420px"
                />
              </div>
            )}

            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <VegBadge isVeg={product.is_veg} />
              {rank && (
                <span
                  style={{
                    backgroundColor: '#FF6B00',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  #{rank} Most liked
                </span>
              )}
              {product.is_jain && (
                <span
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    color: '#F59E0B',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  JAIN
                </span>
              )}
            </div>

            {/* Dish name */}
            <h2
              style={{
                margin: '10px 0 0',
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 700,
                color: '#1D1D1D',
                lineHeight: 1.2,
              }}
            >
              {product.name}
            </h2>

            {/* Hindi name */}
            {product.name_hindi && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#999',
                }}
              >
                {product.name_hindi}
              </p>
            )}

            {/* Price + spice */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#1D1D1D',
                }}
              >
                {formatPrice(product.price)}
              </span>
              {product.spice_level > 0 && (
                <span style={{ fontSize: 14 }}>{'🌶️'.repeat(product.spice_level)}</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p
                style={{
                  margin: '12px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 400,
                  color: '#666',
                  lineHeight: 1.6,
                }}
              >
                {product.description}
              </p>
            )}

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: '#F0F0F0', margin: '20px 0' }} />

            {/* Action row */}
            {product.is_available ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Qty control */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1.5px solid #E0E0E0',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => qty > 0 && updateQuantity(product.id, qty - 1)}
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: '#F8F8F8',
                      border: 'none',
                      color: '#666',
                      fontSize: 18,
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
                      height: 44,
                      textAlign: 'center',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#1D1D1D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={() => addItem(product)}
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: '#F8F8F8',
                      border: 'none',
                      color: '#666',
                      fontSize: 18,
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
                  onClick={() => {
                    if (qty === 0) addItem(product);
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: primaryColor,
                    color: addBtnText,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: `0 4px 16px rgba(${r},${g},${b},0.25)`,
                  }}
                >
                  Add to order · {formatPrice(product.price)}
                </button>
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: '#E23744',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Currently Unavailable
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
