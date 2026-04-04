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
  products = [],
}: Props) {
  const router = useRouter();
  const { items, updateQuantity, getTotal } = useCart();
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end justify-center"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] max-h-[82vh] bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-4px_40px_rgba(0,0,0,0.2)] sunday-slide-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0 border-b border-gray-100">
            <div className="w-8" />
            <span className="font-body text-base font-bold text-[#1A1A1A]">Basket</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border-none bg-gray-100 text-[#1A1A1A] cursor-pointer flex items-center justify-center"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Empty state */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
              <div className="text-[40px]">🛒</div>
              <p className="font-body text-base font-bold text-[#1A1A1A] m-0 text-center">
                Your basket is empty
              </p>
              <p className="font-body text-[13px] text-[#666] m-0 text-center">
                Add some dishes to get started
              </p>
            </div>
          ) : (
            <>
              {/* Items list */}
              <div className="flex-1 overflow-y-auto py-2">
                {items.map((item) => {
                  const imgUrl = getProductImage(item.product_id);
                  return (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-gray-50"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#F5F5F0] flex items-center justify-center">
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">🍽️</span>
                        )}
                      </div>

                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm font-bold text-[#1A1A1A] truncate">
                          {item.name}
                        </div>
                        <div className="font-body text-[13px] text-[#666] mt-0.5">
                          {formatPrice(item.price)}
                        </div>
                      </div>

                      {/* Qty stepper */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        <span className="font-body text-[15px] font-bold text-[#1A1A1A] min-w-[18px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 bg-transparent text-[#1A1A1A] cursor-pointer flex items-center justify-center"
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
                    className="font-body text-sm font-semibold text-[#1A1A1A] bg-transparent border-none cursor-pointer underline underline-offset-2"
                  >
                    Add more
                  </button>
                </div>

                {/* Order note */}
                <div className="px-5 py-2">
                  {!noteOpen ? (
                    <button
                      onClick={() => setNoteOpen(true)}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg border-none bg-[#F5F5F0] cursor-pointer text-left"
                    >
                      <div>
                        <div className="font-body text-[13px] font-semibold text-[#1A1A1A]">
                          Add an order note
                        </div>
                        <div className="font-body text-xs text-[#666] mt-0.5">
                          {orderNote || 'Utensils, special requests...'}
                        </div>
                      </div>
                      <span className="text-[#666] text-xl leading-none">+</span>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-[#1A1A1A] overflow-hidden bg-[#F5F5F0]">
                      <textarea
                        autoFocus
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        onBlur={() => setNoteOpen(false)}
                        placeholder="Utensils, special requests..."
                        rows={3}
                        className="w-full p-3 border-none bg-transparent text-[#1A1A1A] font-body text-[13px] resize-none outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 px-5 pt-3.5 pb-7 border-t border-gray-100">
                <div className="flex justify-between items-center mb-3.5">
                  <span className="font-body text-[15px] font-semibold text-[#1A1A1A]">Subtotal</span>
                  <span className="font-body text-[15px] font-bold text-[#1A1A1A]">{formatPrice(total)}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-4 rounded-full bg-[#1A1A1A] text-white font-body text-base font-bold border-none cursor-pointer"
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
