'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import PairingSuggestions from './PairingSuggestions';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  tokens: MenuTokens;
  isBestseller?: boolean;
  lang?: 'en' | 'hi';
  onClose: () => void;
  allProducts?: Product[];
}

export default function DishDetailSheetV2({
  product,
  isBestseller,
  lang = 'en',
  onClose,
  allProducts = [],
}: Props) {
  const { items, addItem, updateQuantity, updateNotes } = useCart();
  const reduced = useReducedMotion();
  const [localQty, setLocalQty] = useState(1);
  const [notes, setNotes] = useState('');

  // Swipe-to-close
  const touchStartY = useRef(0);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);

  // Parallax
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgOffset, setImgOffset] = useState(0);

  const handleSheetScroll = useCallback(() => {
    if (!scrollRef.current || reduced) return;
    setImgOffset(Math.min(scrollRef.current.scrollTop * 0.25, 20));
  }, [reduced]);

  function handleHandleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }
  function handleHandleTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) { isDragging.current = true; setDragY(dy); }
  }
  function handleHandleTouchEnd() {
    if (dragY > 80) onClose();
    else setDragY(0);
    isDragging.current = false;
  }

  useEffect(() => {
    if (!product) return;
    setLocalQty(1);
    setImgOffset(0);
    setDragY(0);
    const existing = items.find((i) => i.product_id === product.id);
    setNotes(existing?.notes ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  // Pairing suggestions - items from a different category
  const suggestions = useMemo(() => {
    if (!product?.category_id) return [];
    return allProducts
      .filter((p) => p.category_id !== product.category_id && p.is_available && p.image_url)
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 6);
  }, [product?.category_id, allProducts]);

  if (!product) return null;

  const dish = product;
  const cartItem = items.find((i) => i.product_id === dish.id);
  const cartQty = cartItem?.quantity ?? 0;
  const primaryName = (lang === 'hi' && dish.name_hindi) ? dish.name_hindi : dish.name;

  function handleAddToOrder() {
    if (cartQty === 0) {
      for (let i = 0; i < localQty; i++) addItem(dish);
    } else {
      updateQuantity(dish.id, cartQty + localQty);
    }
    updateNotes(dish.id, notes.trim());
    onClose();
  }

  const sheetTransform = dragY > 0 ? `translateY(${dragY}px)` : 'translateY(0)';
  const sheetOpacity = dragY > 50 ? Math.max(0.4, 1 - (dragY - 50) / 200) : 1;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-end justify-center"
        style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.2, 0.5 - dragY / 400)})` }}
      >
        <div
          ref={scrollRef}
          onClick={(e) => e.stopPropagation()}
          onScroll={handleSheetScroll}
          className={`w-full max-w-[480px] bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-[0_-4px_32px_rgba(0,0,0,0.15)] relative ${
            reduced ? '' : 'sunday-slide-up'
          }`}
          style={{
            overflowY: dragY > 0 ? 'hidden' : 'auto',
            transform: sheetTransform,
            opacity: sheetOpacity,
            transition: dragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Drag handle */}
          <div
            className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-2.5 pb-1 touch-none cursor-grab"
            onTouchStart={handleHandleTouchStart}
            onTouchMove={handleHandleTouchMove}
            onTouchEnd={handleHandleTouchEnd}
          >
            <div className={`w-9 h-1 rounded-full ${dish.image_url ? 'bg-white/50' : 'bg-gray-300'}`} />
          </div>

          {/* Back button */}
          <button
            onClick={onClose}
            className={`absolute top-3 left-3 z-[11] w-9 h-9 rounded-full flex items-center justify-center ${
              dish.image_url
                ? 'bg-[#1A1A1A] text-white shadow-md'
                : 'bg-gray-100 text-[#1A1A1A]'
            }`}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          {/* Hero image */}
          {dish.image_url ? (
            <div className="w-full aspect-[4/5] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dish.image_url}
                alt={dish.name}
                className="w-full h-[115%] -mt-[7.5%] object-cover block will-change-transform"
                style={{
                  transform: reduced ? 'none' : `translateY(${-imgOffset}px)`,
                  transition: 'none',
                }}
              />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-[#F5F5F0] flex items-center justify-center">
              <Utensils size={48} color="#ccc" strokeWidth={1} />
            </div>
          )}

          {/* Content */}
          <div className={`${dish.image_url ? 'pt-5' : 'pt-12'} px-5 pb-36`}>
            {/* Orderable badge */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />
              <span className="font-body text-xs text-[#666] font-medium">
                {dish.is_available ? 'Orderable' : 'Sold out'}
              </span>
              {isBestseller && (
                <span className="font-body text-[10px] font-bold text-[#666] bg-[#F5F5F0] rounded px-1.5 py-0.5">
                  Popular
                </span>
              )}
              {dish.is_jain && (
                <span className="font-body text-[10px] font-bold text-[#666] bg-[#F5F5F0] rounded px-1.5 py-0.5">
                  Jain
                </span>
              )}
            </div>

            {/* Dish name */}
            <h2 className="font-display text-2xl font-bold text-[#1A1A1A] leading-tight mb-2">
              {primaryName}
            </h2>

            {/* Description */}
            {dish.description && (
              <p className="font-body text-sm text-[#666] leading-relaxed mb-4">
                {dish.description}
              </p>
            )}

            {/* Price */}
            <p className="font-body text-lg font-semibold text-[#1A1A1A] mb-5">
              ₹{dish.price}
            </p>

            {/* Allergens */}
            {dish.allergens && dish.allergens.length > 0 && (
              <div className="mb-4">
                <span className="font-body text-[11px] font-semibold text-[#666] bg-[#F5F5F0] rounded-full px-3 py-1">
                  Contains: {dish.allergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
                </span>
              </div>
            )}

            {/* Pairing suggestions */}
            <PairingSuggestions suggestions={suggestions} />
          </div>

          {/* Bottom add bar - fixed */}
          {dish.is_available ? (
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-3 z-[101]">
              {/* Qty stepper */}
              <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                <button
                  onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                  className="w-11 h-12 bg-transparent border-none text-[#1A1A1A] text-xl font-light cursor-pointer flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-8 text-center font-body text-base font-bold text-[#1A1A1A]">
                  {localQty}
                </span>
                <button
                  onClick={() => setLocalQty((q) => q + 1)}
                  className="w-11 h-12 bg-transparent border-none text-[#1A1A1A] text-xl font-light cursor-pointer flex items-center justify-center"
                >
                  +
                </button>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddToOrder}
                className="flex-1 py-4 rounded-full text-white font-body text-[15px] font-bold border-none cursor-pointer"
                style={{ backgroundColor: 'var(--sunday-accent)' }}
              >
                Add {localQty} item{localQty > 1 ? 's' : ''} · ₹{dish.price * localQty}
              </button>
            </div>
          ) : (
            <div className="text-center text-red-500 font-body text-sm font-bold py-4">
              Sold out
            </div>
          )}
        </div>
      </div>
    </>
  );
}
