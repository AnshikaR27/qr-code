'use client';

import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke={color} strokeWidth="1.5" fill="rgba(0,0,0,0.5)" />
      <circle cx="7" cy="7" r="3.5" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product;
  rank: 1 | 2 | 3 | null;
  primaryColor: string;
  onTap: (product: Product) => void;
}

export default function DishCard({ product, rank, primaryColor, onTap }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const { r, g, b } = hexToRgb(primaryColor);
  const hasImage = !!product.image_url;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (product.is_available) addItem(product);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(product.id, qty - 1);
  }

  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation();
    addItem(product);
  }

  return (
    <div onClick={() => onTap(product)} style={{ cursor: 'pointer' }}>
      {/* Square card area */}
      <div
        style={{
          aspectRatio: '1',
          borderRadius: 14,
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(145deg, #1a1a1a, #111)',
        }}
      >
        {hasImage ? (
          <Image
            src={product.image_url!}
            alt={product.name}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 420px) 50vw, 200px"
          />
        ) : (
          /* Branded no-image placeholder */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(145deg, rgba(${r},${g},${b},0.08), #0a0a0a 60%, rgba(${r},${g},${b},0.04))`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Dot pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.03,
                backgroundImage: `radial-gradient(circle, ${primaryColor} 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }}
            />
            {/* Ring with initial */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                border: `1.5px solid rgba(${r},${g},${b},0.2)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: `rgba(${r},${g},${b},0.4)` }}>
                {product.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span
              style={{
                marginTop: 8,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: `rgba(${r},${g},${b},0.25)`,
                textTransform: 'uppercase',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {product.is_veg ? 'PURE VEG' : 'NON VEG'}
            </span>
          </div>
        )}

        {/* Sold out overlay */}
        {!product.is_available && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#999', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
              SOLD OUT
            </span>
          </div>
        )}

        {/* #N Most liked badge — top left */}
        {rank && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: primaryColor,
              padding: '3px 8px',
              borderRadius: 6,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              boxShadow: `0 2px 8px rgba(${r},${g},${b},0.4)`,
            }}
          >
            #{rank} Most liked
          </div>
        )}

        {/* Veg badge — top right */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <VegSymbol isVeg={product.is_veg} />
        </div>

        {/* + / [− qty +] button — bottom right */}
        {product.is_available && (
          <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
            {qty === 0 ? (
              <button
                onClick={handleAdd}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  border: '1px solid #333',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  border: `1px solid ${primaryColor}`,
                  borderRadius: 20,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={handleRemove}
                  style={{
                    width: 28,
                    height: 28,
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: 16,
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
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 16,
                    textAlign: 'center',
                  }}
                >
                  {qty}
                </span>
                <button
                  onClick={handleIncrease}
                  style={{
                    width: 28,
                    height: 28,
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text below the square */}
      <div style={{ padding: '10px 4px 0' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
          {product.name}
        </p>
        {product.name_hindi && (
          <p style={{ margin: '1px 0 0', fontSize: 10, fontWeight: 500, color: '#555' }}>
            {product.name_hindi}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#999' }}>
            {formatPrice(product.price)}
          </span>
          {product.spice_level > 0 && (
            <span style={{ fontSize: 11 }}>{'🌶️'.repeat(product.spice_level)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
