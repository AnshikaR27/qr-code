'use client';

import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import { formatPrice, getContrastText } from '@/lib/utils';
import type { Product } from '@/types';

function VegBadge({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#0F8A00' : '#E23744';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="14" rx="2" stroke={color} strokeWidth="1.5" fill="white" />
      <circle cx="8" cy="8" r="4" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product;
  rank: 1 | 2 | 3 | null;
  primaryColor: string;
  onTap: (product: Product) => void;
  animationDelay: number;
}

export default function DishCard({ product, rank, primaryColor, onTap, animationDelay }: Props) {
  const { items, addItem } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const addBtnTextColor = getContrastText(primaryColor);
  const hasImage = !!product.image_url;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (product.is_available) addItem(product);
  }

  return (
    <div
      onClick={() => onTap(product)}
      style={{
        backgroundColor: '#FFFFFF',
        margin: '0 16px 16px',
        borderRadius: 16,
        border: '1px solid #F0F0F0',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: product.is_available ? 1 : 0.4,
        position: 'relative',
        animation: 'fadeInCard 0.3s ease both',
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Photo area — only if image exists */}
      {hasImage && (
        <div
          style={{
            margin: '12px 12px 0',
            aspectRatio: '4/3',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#F5F5F5',
            position: 'relative',
          }}
        >
          <Image
            src={product.image_url!}
            alt={product.name}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 420px) 90vw, 380px"
          />
        </div>
      )}

      {/* Content area */}
      <div style={{ padding: '14px 14px 16px', position: 'relative' }}>
        {/* Row 1: veg badge + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 52 }}>
          <div style={{ paddingTop: 2 }}>
            <VegBadge isVeg={product.is_veg} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 700,
                color: '#1D1D1D',
                lineHeight: 1.35,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {rank && (
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#FF6B00',
                    color: '#FFFFFF',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 5,
                    marginRight: 6,
                    verticalAlign: 'middle',
                    lineHeight: 1.6,
                  }}
                >
                  #{rank} Most liked
                </span>
              )}
              {product.name}
            </p>

            {/* Row 2: Hindi name */}
            {product.name_hindi && (
              <p
                style={{
                  margin: '3px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#999',
                }}
              >
                {product.name_hindi}
              </p>
            )}

            {/* Row 3: Description */}
            {product.description && (
              <p
                style={{
                  margin: '5px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 400,
                  color: '#999',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Row 4: Price + spice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingRight: 52,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 700,
              color: '#1D1D1D',
            }}
          >
            {formatPrice(product.price)}
          </span>
          {product.spice_level > 0 && (
            <span style={{ fontSize: 12 }}>{'🌶️'.repeat(product.spice_level)}</span>
          )}
        </div>

        {/* Unavailable notice */}
        {!product.is_available && (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              color: '#E23744',
            }}
          >
            Currently Unavailable
          </p>
        )}

        {/* Floating add button */}
        {product.is_available && (
          <div style={{ position: 'absolute', right: 14, bottom: 14 }}>
            <button
              onClick={handleAdd}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: primaryColor,
                color: addBtnTextColor,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                fontSize: 22,
                fontWeight: 500,
                position: 'relative',
              }}
            >
              +
              {qty > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: '#FF6B00',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {qty}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
