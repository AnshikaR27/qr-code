'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  tableId: string | null;
  tokens: MenuTokens;
}

export default function CartSheet({ open, onClose, restaurant, tableId, tokens }: Props) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, getTotal } = useCart();
  const total = getTotal();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  function handlePlaceOrder() {
    // Save for "repeat last order" feature
    localStorage.setItem(
      `last-order-${restaurant.slug}`,
      JSON.stringify({
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          is_veg: i.is_veg,
          notes: i.notes,
        })),
        total,
        savedAt: Date.now(),
      })
    );

    sessionStorage.setItem('pendingOrder', JSON.stringify({
      restaurant_id: restaurant.id,
      table_id: tableId,
      order_type: 'dine_in',
      customer_name: null,
      customer_phone: null,
      items: items.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        notes: i.notes || null,
      })),
    }));
    onClose();
    router.push(`/${restaurant.slug}/order`);
  }

  return (
    <>
      <style>{`
        @keyframes cartSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/*
        Outer overlay: blurred backdrop + flex bottom-align.
        Same pattern as DishDetailSheet — the flex container handles
        centering; the inner sheet needs NO transform of its own,
        so the animation's translateY has nothing to conflict with.
      */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {/* Inner sheet — stops click propagation so tapping it doesn't close */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            height: '78vh',
            backgroundColor: tokens.cardBg,
            borderRadius: '24px 24px 0 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
            animation: 'cartSlideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1) both',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              flexShrink: 0,
              backgroundColor: tokens.headerGradient,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: `${tokens.primary}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ShoppingBag size={18} color={tokens.text} />
              </div>
              <div>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 15, fontWeight: 900, color: tokens.text, margin: 0, lineHeight: 1.2 }}>
                  Your Order
                </p>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 11, color: tokens.textMuted, margin: 0 }}>
                  {restaurant.name}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                border: 'none', backgroundColor: `${tokens.primary}22`,
                color: tokens.text, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Empty state ── */}
          {items.length === 0 ? (
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: '0 32px',
              }}
            >
              <div
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  backgroundColor: `${tokens.primary}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                }}
              >
                🛒
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 17, fontWeight: 900, color: tokens.text, margin: 0 }}>
                  Your cart is empty
                </p>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 13, color: tokens.textMuted, marginTop: 4 }}>
                  Add some delicious dishes to get started!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Items list ── */}
              <div
                style={{
                  flex: 1, overflowY: 'auto',
                  padding: '12px 20px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}
              >
                {items.map((item) => (
                  <div key={item.product_id}>
                    {/* Row: dot + name | qty stepper | price + trash */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                      {/* Veg/non-veg indicator */}
                      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                        <rect x="1" y="1" width="16" height="16" rx="2.5"
                          stroke={item.is_veg ? tokens.veg : tokens.nonveg}
                          strokeWidth="2" fill={tokens.cardBg} />
                        <circle cx="9" cy="9" r="4.5" fill={item.is_veg ? tokens.veg : tokens.nonveg} />
                      </svg>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
                          color: tokens.text, margin: 0, lineHeight: 1.3,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}>
                          {item.name}
                        </p>
                        {item.notes && (
                          <p style={{ fontFamily: tokens.fontBody, fontSize: 11, color: tokens.textMuted, margin: '2px 0 0', fontStyle: 'italic' }}>
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Qty stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            border: `2px solid ${tokens.primary}`,
                            color: tokens.primary, background: 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Minus size={11} strokeWidth={3} />
                        </button>
                        <span style={{
                          fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 900,
                          color: tokens.primary, minWidth: 18, textAlign: 'center',
                        }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            border: 'none', backgroundColor: tokens.primary,
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Plus size={11} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Price */}
                      <span style={{
                        fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 800,
                        color: tokens.text, minWidth: 48, textAlign: 'right', flexShrink: 0,
                      }}>
                        {formatPrice(item.price * item.quantity)}
                      </span>

                      {/* Trash */}
                      <button
                        onClick={() => removeItem(item.product_id)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: tokens.textMuted, flexShrink: 0,
                          display: 'flex', alignItems: 'center', padding: 3,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = tokens.error; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = tokens.textMuted; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Footer: total + CTA ── */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '14px 20px 28px',
                  backgroundColor: tokens.surfaceLow,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <p style={{
                    fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700,
                    color: tokens.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.1em', margin: 0,
                  }}>
                    Total
                  </p>
                  <p style={{
                    fontFamily: tokens.fontBody, fontSize: 22, fontWeight: 900,
                    color: tokens.text, margin: 0, lineHeight: 1.1,
                  }}>
                    {formatPrice(total)}
                  </p>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  style={{
                    flex: 1, padding: '15px 0', borderRadius: 20,
                    background: tokens.ctaGradient, color: '#fff',
                    fontFamily: tokens.fontBody, fontSize: 15, fontWeight: 900,
                    border: 'none', cursor: 'pointer', letterSpacing: '0.02em',
                    boxShadow: `0 6px 24px ${tokens.accent}26`,
                  }}
                >
                  Place Order →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
