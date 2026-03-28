'use client';

import { useCart } from '@/hooks/useCart';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

function VegBadge({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#0F8A00' : '#E23744';
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill="white" />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  dish: Product;
  tokens: MenuTokens;
  index: number;
  isBestseller: boolean;
  onTap: () => void;
}

export default function DishCard({ dish, tokens, index, isBestseller, onTap }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.product_id === dish.id);
  const qty = cartItem?.quantity ?? 0;
  const popShadow = `${tokens.primary}4d`;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    addItem(dish);
  }

  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty + 1);
  }

  function handleDecrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty - 1);
  }

  return (
    <div
      onClick={dish.is_available ? onTap : undefined}
      style={{
        margin: '0 16px 12px',
        borderRadius: 16,
        backgroundColor: tokens.cardBg,
        overflow: 'hidden',
        cursor: dish.is_available ? 'pointer' : 'default',
        opacity: dish.is_available ? 1 : 0.4,
        display: 'flex',
        flexDirection: 'row',
        transition: 'all 0.2s ease',
        animation: 'fadeUp 0.4s ease both',
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Left — Image (only if exists) */}
      {dish.image_url && (
        <div
          style={{
            width: 130,
            height: 130,
            flexShrink: 0,
            margin: '12px 0 12px 12px',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dish.image_url}
            alt={dish.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Right — Content */}
      <div
        style={{
          flex: 1,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        {/* Top section */}
        <div>
          {/* Row 1: Veg badge + Name + badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              marginBottom: 2,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ paddingTop: 2 }}>
              <VegBadge isVeg={dish.is_veg} />
            </div>
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.text,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {dish.name}
            </span>
          </div>

          {/* Bestseller + Jain badges row */}
          {(isBestseller || dish.is_jain) && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
              {isBestseller && (
                <span
                  style={{
                    backgroundColor: tokens.accent,
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
              {dish.is_jain && (
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
          )}

          {/* Row 2: Hindi name */}
          {dish.name_hindi && (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 500,
                color: tokens.textMuted,
                marginBottom: 4,
              }}
            >
              {dish.name_hindi}
            </div>
          )}

          {/* Row 3: Description */}
          {dish.description && (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 13,
                fontWeight: 400,
                color: tokens.textMuted,
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

        {/* Row 4: Price + Add button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: 8,
          }}
        >
          {dish.is_available ? (
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 16,
                fontWeight: 800,
                color: tokens.text,
              }}
            >
              ₹{dish.price}
              {dish.spice_level > 0 && (
                <span style={{ marginLeft: 4, fontSize: 12 }}>
                  {'🌶️'.repeat(dish.spice_level)}
                </span>
              )}
            </span>
          ) : (
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 700,
                color: '#E23744',
              }}
            >
              Sold out
            </span>
          )}

          {dish.is_available && (
            qty === 0 ? (
              <button
                onClick={handleAdd}
                style={{
                  backgroundColor: tokens.primary,
                  color: '#fff',
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  fontWeight: 800,
                  padding: '8px 18px',
                  borderRadius: 50,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 2px 10px ${popShadow}`,
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                ⊕ Add
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: tokens.primary,
                  borderRadius: 50,
                  boxShadow: `0 2px 10px ${popShadow}`,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={handleDecrease}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18,
                    width: 36,
                    height: 36,
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
                    color: '#fff',
                    fontWeight: 800,
                    fontFamily: tokens.fontBody,
                    fontSize: 14,
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {qty}
                </span>
                <button
                  onClick={handleIncrease}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18,
                    width: 36,
                    height: 36,
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
            )
          )}
        </div>
      </div>
    </div>
  );
}
