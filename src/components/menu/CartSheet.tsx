'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import type { Restaurant } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  tableId: string | null;
}

type OrderType = 'dine_in' | 'parcel';

export default function CartSheet({ open, onClose, restaurant, tableId }: Props) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, updateNotes, getTotal } = useCart();
  const [orderType, setOrderType] = useState<OrderType>(tableId ? 'dine_in' : 'parcel');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameError, setNameError] = useState('');

  const total = getTotal();
  const p = restaurant.primary_color;

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
      >
        {/* Colored header strip */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${restaurant.secondary_color} 0%, ${p} 100%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="font-black text-white text-base leading-tight">Your Order</p>
              <p className="text-xs text-white/70">{restaurant.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ backgroundColor: `${p}12` }}
            >
              🛒
            </div>
            <div className="text-center">
              <p className="font-black text-gray-700 text-lg">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add some delicious dishes to get started!</p>
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
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-1">
                      <rect x="1" y="1" width="16" height="16" rx="2.5"
                        stroke={item.is_veg ? '#16a34a' : '#dc2626'} strokeWidth="2" fill="white" />
                      <circle cx="9" cy="9" r="4.5" fill={item.is_veg ? '#16a34a' : '#dc2626'} />
                    </svg>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 leading-tight">{item.name}</p>
                      {item.name_hindi && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.name_hindi}</p>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center border-2 active:scale-90 transition-transform"
                        style={{ borderColor: p, color: p }}
                      >
                        <Minus className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span className="w-5 text-center text-sm font-black" style={{ color: p }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                        style={{ backgroundColor: p }}
                      >
                        <Plus className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm font-black w-14 text-right" style={{ color: p }}>
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
                      backgroundColor: `${p}06`,
                      borderColor: `${p}20`,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = `${p}50`; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = `${p}20`; }}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 pt-3 pb-6 space-y-3 bg-white border-t border-gray-100">
              {/* Order type toggle */}
              <div
                className="flex p-1 rounded-2xl gap-1"
                style={{ backgroundColor: `${p}10` }}
              >
                {(['dine_in', 'parcel'] as OrderType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                      orderType === type ? 'text-white shadow-md' : 'text-gray-500'
                    )}
                    style={
                      orderType === type
                        ? { backgroundColor: p, boxShadow: `0 4px 12px ${p}45` }
                        : {}
                    }
                  >
                    {type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
                  </button>
                ))}
              </div>

              {/* Parcel fields */}
              {orderType === 'parcel' && (
                <div className="space-y-2 animate-fade-in-up">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => { setCustomerName(e.target.value); setNameError(''); }}
                    placeholder="Your name *"
                    className={cn(
                      'w-full text-sm px-4 py-3 rounded-xl border-2 outline-none transition-all',
                      nameError ? 'border-red-400 bg-red-50' : ''
                    )}
                    style={!nameError ? { borderColor: `${p}30`, backgroundColor: `${p}06` } : {}}
                    onFocus={(e) => { if (!nameError) e.currentTarget.style.borderColor = `${p}70`; }}
                    onBlur={(e)  => { if (!nameError) e.currentTarget.style.borderColor = `${p}30`; }}
                  />
                  {nameError && <p className="text-xs text-red-500 font-semibold px-1">{nameError}</p>}
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone number (optional)"
                    className="w-full text-sm px-4 py-3 rounded-xl border-2 outline-none transition-all"
                    style={{ borderColor: `${p}30`, backgroundColor: `${p}06` }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = `${p}70`; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = `${p}30`; }}
                  />
                </div>
              )}

              {/* Total + CTA */}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                  <p className="text-2xl font-black text-gray-900">{formatPrice(total)}</p>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 py-4 rounded-2xl text-white text-[15px] font-black tracking-wide active:scale-[0.97] transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${restaurant.secondary_color} 0%, ${p} 100%)`,
                    boxShadow: `0 6px 24px ${p}55`,
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
