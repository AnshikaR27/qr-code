'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn, formatPrice } from '@/lib/utils';
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

type OrderType = 'dine_in' | 'parcel';

export default function CartSheet({ open, onClose, restaurant, tableId, tokens }: Props) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, updateNotes, getTotal } = useCart();
  const [orderType, setOrderType] = useState<OrderType>(tableId ? 'dine_in' : 'parcel');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameError, setNameError] = useState('');

  const total = getTotal();

  function handlePlaceOrder() {
    if (orderType === 'parcel' && !customerName.trim()) {
      setNameError('Name is required for parcel orders');
      return;
    }
    setNameError('');
    sessionStorage.setItem('pendingOrder', JSON.stringify({
      restaurant_id: restaurant.id,
      table_id: orderType === 'dine_in' ? tableId : null,
      order_type: orderType,
      customer_name: orderType === 'parcel' ? customerName.trim() : null,
      customer_phone: orderType === 'parcel' ? customerPhone.trim() || null : null,
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
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[90vh] flex flex-col p-0 border-0 rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: tokens.cardBg }}
      >
        {/* Gradient header strip */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: tokens.headerGradient }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${tokens.primary}20` }}>
              <ShoppingBag className="w-4.5 h-4.5" style={{ color: tokens.text }} />
            </div>
            <div>
              <p className="font-black text-base leading-tight" style={{ color: tokens.text }}>
                Your Order
              </p>
              <p className="text-xs" style={{ color: tokens.textMuted }}>
                {restaurant.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${tokens.primary}20` }}
          >
            <X className="w-4 h-4" style={{ color: tokens.text }} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ backgroundColor: `${tokens.primary}15` }}
            >
              🛒
            </div>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: tokens.text }}>
                Your cart is empty
              </p>
              <p className="text-sm mt-1" style={{ color: tokens.textMuted }}>
                Add some delicious dishes to get started!
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.product_id} className="space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Veg symbol */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 18 18"
                      fill="none"
                      className="flex-shrink-0 mt-1"
                    >
                      <rect
                        x="1" y="1" width="16" height="16" rx="2.5"
                        stroke={item.is_veg ? tokens.veg : tokens.nonveg}
                        strokeWidth="2"
                        fill={tokens.cardBg}
                      />
                      <circle
                        cx="9" cy="9" r="4.5"
                        fill={item.is_veg ? tokens.veg : tokens.nonveg}
                      />
                    </svg>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold leading-tight"
                        style={{ color: tokens.text }}
                      >
                        {item.name}
                      </p>
                      {item.name_hindi && (
                        <p className="text-xs mt-0.5" style={{ color: tokens.textMuted }}>
                          {item.name_hindi}
                        </p>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center border-2 active:scale-90 transition-transform"
                        style={{ borderColor: tokens.primary, color: tokens.primary }}
                      >
                        <Minus className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span
                        className="w-5 text-center text-sm font-black"
                        style={{ color: tokens.primary }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                        style={{ backgroundColor: tokens.primary, color: '#fff' }}
                      >
                        <Plus className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-sm font-black w-14 text-right"
                        style={{ color: tokens.text }}
                      >
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                        style={{ color: tokens.textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = tokens.error; e.currentTarget.style.backgroundColor = `${tokens.error}15`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateNotes(item.product_id, e.target.value)}
                    placeholder="Special instructions (less spicy, no onion…)"
                    className="w-full ml-[28px] text-xs px-3 py-1.5 outline-none"
                    style={{
                      backgroundColor: tokens.surfaceLow,
                      border: 'none',
                      borderBottom: '2px solid transparent',
                      borderRadius: '8px 8px 0 0',
                      color: tokens.textMuted,
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.bg;
                      e.currentTarget.style.borderBottomColor = tokens.accent;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.surfaceLow;
                      e.currentTarget.style.borderBottomColor = 'transparent';
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Footer — tonal surface shift instead of border-t per No-Line rule */}
            <div
              className="flex-shrink-0 px-5 pt-3 pb-6 space-y-3"
              style={{ backgroundColor: tokens.surfaceLow }}
            >
              {/* Order type toggle */}
              <div
                className="flex p-1 rounded-2xl gap-1"
                style={{ backgroundColor: `${tokens.primary}12` }}
              >
                {(['dine_in', 'parcel'] as OrderType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200'
                    )}
                    style={
                      orderType === type
                        ? {
                            backgroundColor: tokens.primary,
                            color: '#fff',
                            boxShadow: `0 4px 12px ${tokens.primary}1a`,
                          }
                        : { color: tokens.textMuted }
                    }
                  >
                    {type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
                  </button>
                ))}
              </div>

              {/* Parcel fields */}
              {orderType === 'parcel' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => { setCustomerName(e.target.value); setNameError(''); }}
                    placeholder="Your name *"
                    className="w-full text-sm px-4 py-3 outline-none"
                    style={{
                      backgroundColor: nameError ? `${tokens.error}12` : tokens.bg,
                      border: 'none',
                      borderBottom: nameError
                        ? `2px solid ${tokens.error}`
                        : '2px solid transparent',
                      borderRadius: '10px 10px 0 0',
                      color: tokens.text,
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                    }}
                    onFocus={(e) => {
                      if (!nameError) e.currentTarget.style.borderBottomColor = tokens.accent;
                    }}
                    onBlur={(e) => {
                      if (!nameError) e.currentTarget.style.borderBottomColor = 'transparent';
                    }}
                  />
                  {nameError && (
                    <p className="text-xs font-semibold px-1" style={{ color: tokens.error }}>{nameError}</p>
                  )}
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone number (optional)"
                    className="w-full text-sm px-4 py-3 outline-none"
                    style={{
                      backgroundColor: tokens.bg,
                      border: 'none',
                      borderBottom: '2px solid transparent',
                      borderRadius: '10px 10px 0 0',
                      color: tokens.text,
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderBottomColor = tokens.accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                  />
                </div>
              )}

              {/* Total + CTA */}
              <div className="flex items-center gap-4">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: tokens.textMuted }}
                  >
                    Total
                  </p>
                  <p className="text-2xl font-black" style={{ color: tokens.text }}>
                    {formatPrice(total)}
                  </p>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 py-4 rounded-2xl text-[15px] font-black tracking-wide active:scale-[0.97] transition-all"
                  style={{
                    background: tokens.ctaGradient,
                    color: '#fff',
                    boxShadow: `0 6px 24px ${tokens.accent}1a`,
                  }}
                >
                  Place Order →
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
