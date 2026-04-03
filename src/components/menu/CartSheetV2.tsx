'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Minus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant, Product } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  tableId: string | null;
  tokens: MenuTokens;
  products?: Product[];
}

export default function CartSheetV2({
  open,
  onClose,
  restaurant,
  tableId,
  tokens,
  products = [],
}: Props) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, getTotal } = useCart();
  const total = getTotal();
  const [noteOpen, setNoteOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  function handlePlaceOrder() {
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
        notes: orderNote.trim() || i.notes || null,
      })),
    }));
    onClose();
    router.push(`/${restaurant.slug}/order`);
  }

  function getProductImage(productId: string): string | null {
    return products.find((p) => p.id === productId)?.image_url ?? null;
  }

  return (
    <>
      <style>{`
        @keyframes cartSlideUpV2 {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '82vh',
            backgroundColor: tokens.cardBg,
            borderRadius: '20px 20px 0 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
            animation: 'cartSlideUpV2 0.35s cubic-bezier(0.32, 0.72, 0, 1) both',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px 14px',
              flexShrink: 0,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            <div style={{ width: 32 }} />
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.text,
              }}
            >
              Basket
            </span>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: `${tokens.text}12`,
                color: tokens.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Empty state ── */}
          {items.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '0 32px',
              }}
            >
              <div style={{ fontSize: 40 }}>🛒</div>
              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 16,
                  fontWeight: 700,
                  color: tokens.text,
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                Your basket is empty
              </p>
              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 13,
                  color: tokens.textMuted,
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                Add some dishes to get started
              </p>
            </div>
          ) : (
            <>
              {/* ── Items list ── */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 0',
                }}
              >
                {items.map((item) => {
                  const imgUrl = getProductImage(item.product_id);
                  return (
                    <div
                      key={item.product_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 20px',
                        borderBottom: `1px solid ${tokens.border}`,
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          overflow: 'hidden',
                          flexShrink: 0,
                          backgroundColor: imgUrl ? undefined : `${tokens.primary}18`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgUrl}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>🍽️</span>
                        )}
                      </div>

                      {/* Name + price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: 14,
                            fontWeight: 700,
                            color: tokens.text,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: 13,
                            color: tokens.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {formatPrice(item.price)}
                        </div>
                      </div>

                      {/* Qty stepper */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: `1.5px solid ${tokens.border}`,
                            backgroundColor: 'transparent',
                            color: tokens.text,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        <span
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: 15,
                            fontWeight: 700,
                            color: tokens.text,
                            minWidth: 18,
                            textAlign: 'center',
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: `1.5px solid ${tokens.border}`,
                            backgroundColor: 'transparent',
                            color: tokens.text,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add more button */}
                <div style={{ padding: '12px 20px 4px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 999,
                      border: `1.5px solid ${tokens.border}`,
                      backgroundColor: 'transparent',
                      color: tokens.text,
                      fontFamily: tokens.fontBody,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Add more
                  </button>
                </div>

                {/* Order note */}
                <div style={{ padding: '8px 20px 12px' }}>
                  {!noteOpen ? (
                    <button
                      onClick={() => setNoteOpen(true)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: 'none',
                        backgroundColor: tokens.surfaceLow,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: 13,
                            fontWeight: 600,
                            color: tokens.text,
                          }}
                        >
                          Add an order note
                        </div>
                        {!orderNote && (
                          <div
                            style={{
                              fontFamily: tokens.fontBody,
                              fontSize: 12,
                              color: tokens.textMuted,
                              marginTop: 2,
                            }}
                          >
                            Utensils, special requests…
                          </div>
                        )}
                        {orderNote && (
                          <div
                            style={{
                              fontFamily: tokens.fontBody,
                              fontSize: 12,
                              color: tokens.textMuted,
                              marginTop: 2,
                              fontStyle: 'italic',
                            }}
                          >
                            {orderNote}
                          </div>
                        )}
                      </div>
                      <span style={{ color: tokens.textMuted, fontSize: 20, lineHeight: 1 }}>+</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        borderRadius: 12,
                        border: `1.5px solid ${tokens.primary}`,
                        overflow: 'hidden',
                        backgroundColor: tokens.surfaceLow,
                      }}
                    >
                      <textarea
                        autoFocus
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        onBlur={() => setNoteOpen(false)}
                        placeholder="Utensils, special requests…"
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: 'none',
                          background: 'transparent',
                          color: tokens.text,
                          fontFamily: tokens.fontBody,
                          fontSize: 13,
                          resize: 'none',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '14px 20px 28px',
                  borderTop: `1px solid ${tokens.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: 15,
                      fontWeight: 600,
                      color: tokens.text,
                    }}
                  >
                    Subtotal
                  </span>
                  <span
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: 15,
                      fontWeight: 700,
                      color: tokens.text,
                    }}
                  >
                    {formatPrice(total)}
                  </span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  style={{
                    width: '100%',
                    padding: '16px 0',
                    borderRadius: 999,
                    backgroundColor: tokens.text,
                    color: tokens.cardBg,
                    fontFamily: tokens.fontBody,
                    fontSize: 16,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Order
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
