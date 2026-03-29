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

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  function handlePlaceOrder() {
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

      {/* Blurred overlay — tap to close */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Cart sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 420,
          height: '90vh',
          zIndex: 71,
          backgroundColor: tokens.cardBg,
          borderRadius: '24px 24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'cartSlideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) both',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            flexShrink: 0,
            background: tokens.headerGradient,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: `${tokens.primary}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingBag size={18} style={{ color: tokens.text }} />
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

          {/* Single X button */}
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: `${tokens.primary}20`,
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

        {items.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '0 32px',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: `${tokens.primary}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
            {/* Items list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map((item) => (
                <div key={item.product_id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Veg/non-veg dot */}
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <rect x="1" y="1" width="16" height="16" rx="2.5"
                        stroke={item.is_veg ? tokens.veg : tokens.nonveg}
                        strokeWidth="2" fill={tokens.cardBg} />
                      <circle cx="9" cy="9" r="4.5" fill={item.is_veg ? tokens.veg : tokens.nonveg} />
                    </svg>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700, color: tokens.text, margin: 0, lineHeight: 1.3 }}>
                        {item.name}
                      </p>
                      {item.name_hindi && (
                        <p style={{ fontFamily: tokens.fontBody, fontSize: 11, color: tokens.textMuted, margin: '2px 0 0' }}>
                          {item.name_hindi}
                        </p>
                      )}
                      {/* Show note if set */}
                      {item.notes && (
                        <p style={{ fontFamily: tokens.fontBody, fontSize: 11, color: tokens.textMuted, margin: '3px 0 0', fontStyle: 'italic' }}>
                          Note: {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: `2px solid ${tokens.primary}`,
                          color: tokens.primary, background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span style={{ fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 900, color: tokens.primary, minWidth: 16, textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: 'none',
                          backgroundColor: tokens.primary, color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>

                    {/* Price + remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 900, color: tokens.text, minWidth: 52, textAlign: 'right' }}>
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.textMuted, display: 'flex', alignItems: 'center', padding: 2 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = tokens.error; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = tokens.textMuted; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                padding: '16px 20px 28px',
                backgroundColor: tokens.surfaceLow,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  Total
                </p>
                <p style={{ fontFamily: tokens.fontBody, fontSize: 24, fontWeight: 900, color: tokens.text, margin: 0, lineHeight: 1.1 }}>
                  {formatPrice(total)}
                </p>
              </div>
              <button
                onClick={handlePlaceOrder}
                style={{
                  flex: 1,
                  padding: '16px 0',
                  borderRadius: 20,
                  background: tokens.ctaGradient,
                  color: '#fff',
                  fontFamily: tokens.fontBody,
                  fontSize: 15,
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  boxShadow: `0 6px 24px ${tokens.accent}1a`,
                }}
              >
                Place Order →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
