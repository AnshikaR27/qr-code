'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Minus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
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
  products = [],
}: Props) {
  const router = useRouter();
  const { items, updateQuantity, getTotal } = useCart();
  const total = getTotal();
  const [customerName, setCustomerName] = useState('');
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
          selected_addons: i.selected_addons,
        })),
        total,
        savedAt: Date.now(),
      })
    );

    sessionStorage.setItem('pendingOrder', JSON.stringify({
      restaurant_id: restaurant.id,
      table_id: tableId,
      order_type: 'dine_in',
      customer_name: customerName.trim() || null,
      customer_phone: null,
      notes: orderNote.trim() || null,
      items: items.map((i) => {
        // Build notes text from legacy addons (child-category style)
        const legacyAddonText = i.addons.length > 0
          ? `Add-ons: ${i.addons.map((a) => `${a.name} (₹${a.price})`).join(', ')}`
          : '';
        const itemNotes = [i.notes, legacyAddonText].filter(Boolean).join(' | ');
        return {
          product_id: i.product_id,
          name: i.name,
          // Price is BASE price only; selected_addons carry their own prices
          price: i.price,
          quantity: i.quantity,
          notes: itemNotes || null,
          // New structured addons
          selected_addons: i.selected_addons,
        };
      }),
    }));
    onClose();
    router.push(`/${restaurant.slug}/order`);
  }

  function getProductImage(productId: string): string | null {
    return products.find((p) => p.id === productId)?.image_url ?? null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70] backdrop-blur-sm flex items-end justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] max-h-[82vh] flex flex-col overflow-hidden sunday-slide-up"
          style={{
            borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5) calc(var(--sunday-radius, 12px) * 1.5) 0 0',
            backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between shrink-0 border-b"
            style={{
              paddingLeft: spacingScale.px,
              paddingRight: spacingScale.px,
              paddingTop: spacingScale.px,
              paddingBottom: spacingScale.cardPad,
              backgroundColor: 'var(--sunday-nav-bg, #efebe2)',
              borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
            }}
          >
            <div className="w-8" />
            <span
              className="font-bold"
              style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
            >
              Basket
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
              style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text, #1c1c17)' }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Empty state */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
              <div className="text-[40px]">🛒</div>
              <p className="font-bold m-0 text-center" style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}>
                Your basket is empty
              </p>
              <p className="m-0 text-center" style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                Add some dishes to get started
              </p>
            </div>
          ) : (
            <>
              {/* Items list */}
              <div className="flex-1 overflow-y-auto py-2">
                {items.map((item) => {
                  const imgUrl = getProductImage(item.product_id);
                  // Total addons price (legacy + new structured addons)
                  const legacyAddonTotal = item.addons.reduce((s, a) => s + a.price, 0);
                  const newAddonTotal = item.selected_addons.reduce((s, a) => s + a.price, 0);
                  const addonTotal = legacyAddonTotal + newAddonTotal;
                  const lineTotal = item.price + addonTotal;

                  return (
                    <div
                      key={item.cart_key}
                      className="flex items-start border-b"
                      style={{
                        gap: spacingScale.gap,
                        paddingLeft: spacingScale.px,
                        paddingRight: spacingScale.px,
                        paddingTop: spacingScale.cardPad,
                        paddingBottom: spacingScale.cardPad,
                        borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        className="overflow-hidden shrink-0 flex items-center justify-center mt-0.5"
                        style={{
                          width: sizeScale.cartThumb,
                          height: sizeScale.cartThumb,
                          borderRadius: 'calc(var(--sunday-radius, 12px) * 0.66)',
                          backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                        }}
                      >
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">🍽️</span>
                        )}
                      </div>

                      {/* Name + addons + price */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold truncate"
                          style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          {item.name}
                        </div>

                        {/* Legacy child-category addons */}
                        {item.addons.length > 0 && (
                          <div
                            className="mt-0.5"
                            style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                          >
                            + {item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}

                        {/* New structured addons — one per line */}
                        {item.selected_addons.map((sa) => (
                          <div
                            key={sa.addon_item_id}
                            className="flex items-center justify-between mt-0.5"
                            style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                          >
                            <span className="pl-2">+ {sa.name}</span>
                            {sa.price > 0 && (
                              <span className="shrink-0 ml-2" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                                +₹{sa.price}
                              </span>
                            )}
                          </div>
                        ))}

                        {/* Line price */}
                        <div
                          className="mt-1"
                          style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          {formatPrice(lineTotal)}
                        </div>
                      </div>

                      {/* Qty stepper */}
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <button
                          onClick={() => updateQuantity(item.cart_key, item.quantity - 1)}
                          className="w-7 h-7 rounded-full bg-transparent cursor-pointer flex items-center justify-center"
                          style={{ border: '1px solid var(--sunday-border, #E8D5B0)', color: 'var(--sunday-text, #1c1c17)' }}
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        <span
                          className="font-bold min-w-[18px] text-center"
                          style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cart_key, item.quantity + 1)}
                          className="w-7 h-7 rounded-full bg-transparent cursor-pointer flex items-center justify-center"
                          style={{ border: '1px solid var(--sunday-border, #E8D5B0)', color: 'var(--sunday-text, #1c1c17)' }}
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add more */}
                <div className="px-5 pt-3 pb-1 flex justify-end">
                  <button
                    onClick={onClose}
                    className="font-semibold bg-transparent border-none cursor-pointer underline underline-offset-2"
                    style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                  >
                    Add more
                  </button>
                </div>

                {/* Customer name */}
                <div className="px-5 pt-2 pb-1">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name (optional)"
                    maxLength={60}
                    className="w-full px-4 py-3.5 border-none outline-none bg-transparent"
                    style={{
                      borderRadius: 'calc(var(--sunday-radius, 12px) * 0.66)',
                      backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                      fontSize: typeScale.body,
                      color: 'var(--sunday-text, #1c1c17)',
                      fontFamily: 'var(--sunday-font-body)',
                    }}
                  />
                </div>

                {/* Order note */}
                <div className="px-5 py-2">
                  {!noteOpen ? (
                    <button
                      onClick={() => setNoteOpen(true)}
                      className="w-full flex items-center justify-between px-4 py-3.5 border-none cursor-pointer text-left"
                      style={{
                        borderRadius: 'calc(var(--sunday-radius, 12px) * 0.66)',
                        backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                      }}
                    >
                      <div>
                        <div
                          className="font-semibold"
                          style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          Add an order note
                        </div>
                        <div
                          className="mt-0.5"
                          style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          {orderNote || 'Utensils, special requests...'}
                        </div>
                      </div>
                      <span className="text-xl leading-none" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>+</span>
                    </button>
                  ) : (
                    <div
                      className="overflow-hidden"
                      style={{
                        borderRadius: 'calc(var(--sunday-radius, 12px) * 0.66)',
                        border: '1px solid var(--sunday-accent, #b12d00)',
                        backgroundColor: 'var(--sunday-bg, #fdf9f0)',
                      }}
                    >
                      <textarea
                        autoFocus
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        onBlur={() => setNoteOpen(false)}
                        placeholder="Utensils, special requests..."
                        rows={3}
                        className="w-full p-3 border-none bg-transparent resize-none outline-none"
                        style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div
                className="shrink-0 border-t"
                style={{
                  paddingLeft: spacingScale.px,
                  paddingRight: spacingScale.px,
                  paddingTop: spacingScale.cardPad,
                  paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
                  backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                  borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
                }}
              >
                <div className="flex justify-between items-center mb-3.5">
                  <span
                    className="font-semibold"
                    style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                  >
                    Subtotal
                  </span>
                  <span
                    className="font-bold"
                    style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                  >
                    {formatPrice(total)}
                  </span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3.5 text-white font-bold border-none cursor-pointer active:scale-[0.98] transition-transform duration-100"
                  style={{
                    fontSize: typeScale.lg,
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                    background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))`,
                    boxShadow: 'var(--sunday-shadow-md)',
                    fontFamily: 'var(--sunday-font-body)',
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
