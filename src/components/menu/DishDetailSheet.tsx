'use client';

import { useEffect } from 'react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

function hexToRgb(hex: string) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function VegSymbol({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16a34a' : '#dc2626';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="8" cy="8" r="4" fill={color} />
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
    if (product) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  if (!product) return null;

  const { r, g, b } = hexToRgb(primaryColor);
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;

  return (
    <>
      <style>{`
        @keyframes slideUp {
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
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 40,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 420,
          zIndex: 50,
          backgroundColor: '#111',
          borderRadius: '20px 20px 0 0',
          border: '1px solid #222',
          maxHeight: '70vh',
          overflowY: 'auto',
          animation: 'slideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 32, height: 4, borderRadius: 4, backgroundColor: '#333' }} />
        </div>

        {/* Content */}
        <div style={{ padding: '8px 22px 28px' }}>
          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <VegSymbol isVeg={product.is_veg} />
            {rank && (
              <span
                style={{
                  backgroundColor: primaryColor,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  boxShadow: `0 2px 8px rgba(${r},${g},${b},0.4)`,
                }}
              >
                #{rank} Most liked
              </span>
            )}
            {product.is_jain && (
              <span
                style={{
                  color: '#d97706',
                  fontSize: 10,
                  fontWeight: 800,
                  border: '1px solid #d97706',
                  padding: '2px 7px',
                  borderRadius: 6,
                }}
              >
                JAIN
              </span>
            )}
          </div>

          {/* Dish name */}
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
            }}
          >
            {product.name}
          </h2>

          {/* Hindi name */}
          {product.name_hindi && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555' }}>
              {product.name_hindi}
            </p>
          )}

          {/* Price + spice */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: primaryColor }}>
              {formatPrice(product.price)}
            </span>
            {product.spice_level > 0 && (
              <span style={{ fontSize: 16 }}>{'🌶️'.repeat(product.spice_level)}</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p style={{ margin: 0, fontSize: 14, color: '#777', lineHeight: 1.65 }}>
              {product.description}
            </p>
          )}

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: '#222', margin: '18px 0' }} />

          {/* Action row */}
          {product.is_available ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Qty control */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1.5px solid #333',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => qty > 0 && updateQuantity(product.id, qty - 1)}
                  style={{
                    width: 40,
                    height: 44,
                    backgroundColor: '#1a1a1a',
                    border: 'none',
                    color: '#fff',
                    fontSize: 18,
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
                    width: 36,
                    height: 44,
                    textAlign: 'center',
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
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
                    width: 40,
                    height: 44,
                    backgroundColor: '#1a1a1a',
                    border: 'none',
                    color: '#fff',
                    fontSize: 18,
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
                  borderRadius: 10,
                  backgroundColor: primaryColor,
                  boxShadow: `0 4px 20px rgba(${r},${g},${b},0.5)`,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {qty > 0
                  ? `Added · ${formatPrice(product.price * qty)}`
                  : `Add to order · ${formatPrice(product.price)}`}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666', fontSize: 14, fontWeight: 600 }}>
              Currently unavailable
            </div>
          )}
        </div>
      </div>
    </>
  );
}
