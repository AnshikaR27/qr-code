'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { BrandPalette } from '@/lib/palette';
import type { Restaurant } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  tableId: string | null;
  palette: BrandPalette;
}

type OrderType = 'dine_in' | 'parcel';

export default function CartSheet({ open, onClose, restaurant, tableId, palette }: Props) {
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
        style={{ backgroundColor: palette.cardBg }}
      >
        {/* Gradient header strip */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: palette.headerGradient }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5" style={{ color: palette.secondaryText }} />
            </div>
            <div>
              <p
                className="font-black text-base leading-tight"
                style={{ color: palette.secondaryText }}
              >
                Your Order
              </p>
              <p
                className="text-xs"
                style={{ color: `${palette.secondaryText}99` }}
              >
                {restaurant.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: palette.secondaryText }} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ backgroundColor: `${palette.pop}15` }}
            >
              🛒
            </div>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: palette.dark }}>
                Your cart is empty
              </p>
              <p className="text-sm mt-1" style={{ color: palette.midDark }}>
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
                        stroke={item.is_veg ? '#0F8A00' : '#E23744'}
                        strokeWidth="2"
                        fill="white"
                      />
                      <circle
                        cx="9" cy="9" r="4.5"
                        fill={item.is_veg ? '#0F8A00' : '#E23744'}
                      />
                    </svg>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold leading-tight"
                        style={{ color: palette.dark }}
                      >
                        {item.name}
                      </p>
                      {item.name_hindi && (
                        <p className="text-xs mt-0.5" style={{ color: palette.midLight }}>
                          {item.name_hindi}
                        </p>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center border-2 active:scale-90 transition-transform"
                        style={{ borderColor: palette.pop, color: palette.pop }}
                      >
                        <Minus className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span
                        className="w-5 text-center text-sm font-black"
                        style={{ color: palette.pop }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                        style={{ backgroundColor: palette.pop }}
                      >
                        <Plus className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-sm font-black w-14 text-right"
                        style={{ color: palette.dark }}
                      >
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
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
                    className="w-full ml-[28px] text-xs px-3 py-2 rounded-xl border-2 outline-none transition-all"
                    style={{
                      backgroundColor: `${palette.pop}06`,
                      borderColor: `${palette.pop}20`,
                      color: palette.midDark,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = `${palette.pop}50`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = `${palette.pop}20`; }}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="flex-shrink-0 px-5 pt-3 pb-6 space-y-3 border-t"
              style={{
                backgroundColor: palette.cardBg,
                borderColor: palette.light,
              }}
            >
              {/* Order type toggle */}
              <div
                className="flex p-1 rounded-2xl gap-1"
                style={{ backgroundColor: `${palette.pop}12` }}
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
                            backgroundColor: palette.pop,
                            color: palette.popText,
                            boxShadow: `0 4px 12px ${palette.pop}45`,
                          }
                        : { color: palette.midDark }
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
                    className={cn(
                      'w-full text-sm px-4 py-3 rounded-xl border-2 outline-none transition-all',
                      nameError ? 'border-red-400 bg-red-50' : ''
                    )}
                    style={
                      !nameError
                        ? {
                            borderColor: `${palette.pop}30`,
                            backgroundColor: `${palette.pop}06`,
                            color: palette.dark,
                          }
                        : {}
                    }
                    onFocus={(e) => {
                      if (!nameError) e.currentTarget.style.borderColor = `${palette.pop}70`;
                    }}
                    onBlur={(e) => {
                      if (!nameError) e.currentTarget.style.borderColor = `${palette.pop}30`;
                    }}
                  />
                  {nameError && (
                    <p className="text-xs text-red-500 font-semibold px-1">{nameError}</p>
                  )}
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone number (optional)"
                    className="w-full text-sm px-4 py-3 rounded-xl border-2 outline-none transition-all"
                    style={{
                      borderColor: `${palette.pop}30`,
                      backgroundColor: `${palette.pop}06`,
                      color: palette.dark,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = `${palette.pop}70`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = `${palette.pop}30`; }}
                  />
                </div>
              )}

              {/* Total + CTA */}
              <div className="flex items-center gap-4">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: palette.midLight }}
                  >
                    Total
                  </p>
                  <p className="text-2xl font-black" style={{ color: palette.dark }}>
                    {formatPrice(total)}
                  </p>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 py-4 rounded-2xl text-[15px] font-black tracking-wide active:scale-[0.97] transition-all"
                  style={{
                    background: palette.ctaGradient,
                    color: palette.neonText,
                    boxShadow: `0 6px 24px ${palette.neon}55`,
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
