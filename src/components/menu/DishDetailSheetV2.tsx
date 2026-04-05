'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Utensils, Check } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import PairingSuggestions from './PairingSuggestions';
import type { MenuTokens } from '@/lib/tokens';
import type { Product, Category, CartAddon } from '@/types';

interface Props {
  product: Product | null;
  tokens: MenuTokens;
  isBestseller?: boolean;
  lang?: 'en' | 'hi';
  onClose: () => void;
  allProducts?: Product[];
  categories?: Category[];
}

export default function DishDetailSheetV2({
  product,
  isBestseller,
  lang = 'en',
  onClose,
  allProducts = [],
  categories = [],
}: Props) {
  const { items, addItem, updateQuantity, updateNotes, updateAddons } = useCart();
  const reduced = useReducedMotion();
  const [localQty, setLocalQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

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

  // Find add-on products for this dish's category
  const addonProducts = useMemo(() => {
    if (!product?.category_id || categories.length === 0) return [];
    // Find child categories of this dish's category (add-ons, sides, extras)
    const childCats = categories.filter((c) => c.parent_category_id === product.category_id);
    if (childCats.length === 0) return [];
    const childCatIds = new Set(childCats.map((c) => c.id));
    return allProducts.filter((p) => p.category_id && childCatIds.has(p.category_id) && p.is_available);
  }, [product?.category_id, categories, allProducts]);

  useEffect(() => {
    if (!product) return;
    setLocalQty(1);
    setImgOffset(0);
    setDragY(0);
    const existing = items.find((i) => i.product_id === product.id);
    setNotes(existing?.notes ?? '');
    // Restore selected addons from cart
    setSelectedAddons(new Set(existing?.addons.map((a) => a.product_id) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  // Pairing suggestions — different category
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

  function toggleAddon(addonProduct: Product) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonProduct.id)) {
        next.delete(addonProduct.id);
      } else {
        next.add(addonProduct.id);
      }
      return next;
    });
  }

  function buildAddons(): CartAddon[] {
    return addonProducts
      .filter((p) => selectedAddons.has(p.id))
      .map((p) => ({ product_id: p.id, name: p.name, price: p.price }));
  }

  const addonTotal = addonProducts
    .filter((p) => selectedAddons.has(p.id))
    .reduce((sum, p) => sum + p.price, 0);

  const itemTotal = (dish.price + addonTotal) * localQty;

  function handleAddToOrder() {
    const addons = buildAddons();
    if (cartQty === 0) {
      for (let i = 0; i < localQty; i++) addItem(dish, addons);
    } else {
      updateQuantity(dish.id, cartQty + localQty);
      updateAddons(dish.id, addons);
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
          className={`w-full max-w-[480px] rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-[0_-4px_32px_rgba(0,0,0,0.15)] relative ${
            reduced ? '' : 'sunday-slide-up'
          }`}
          style={{
            backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
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
            <div
              className="w-9 h-1 rounded-full"
              style={{ backgroundColor: dish.image_url ? 'rgba(255,255,255,0.5)' : 'var(--sunday-border, #E8D5B0)' }}
            />
          </div>

          {/* Back button */}
          <button
            onClick={onClose}
            className="absolute top-3 left-3 z-[11] w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md"
            style={dish.image_url
              ? { background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }
              : { backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text, #1c1c17)' }
            }
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          {/* Hero image */}
          {dish.image_url ? (
            <div className="w-full aspect-[16/9] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dish.image_url}
                alt={dish.name}
                className="w-full h-full object-cover block will-change-transform"
                style={{
                  transform: reduced ? 'none' : `translateY(${-imgOffset}px)`,
                  transition: 'none',
                }}
              />
            </div>
          ) : (
            <div
              className="w-full aspect-[4/3] flex items-center justify-center"
              style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)' }}
            >
              <Utensils size={48} strokeWidth={1} style={{ color: 'var(--sunday-border, #E8D5B0)' }} />
            </div>
          )}

          {/* Content */}
          <div className={`${dish.image_url ? 'pt-5' : 'pt-12'} px-5 pb-36`}>
            {/* Orderable badge */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dish.is_available ? '#0F8A00' : '#E23744' }} />
              <span className="font-body text-xs font-medium" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                {dish.is_available ? 'Orderable' : 'Sold out'}
              </span>
              {isBestseller && (
                <span
                  className="font-body text-[10px] font-bold rounded px-1.5 py-0.5"
                  style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
                >
                  Popular
                </span>
              )}
              {dish.is_jain && (
                <span
                  className="font-body text-[10px] font-bold rounded px-1.5 py-0.5"
                  style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
                >
                  Jain
                </span>
              )}
            </div>

            {/* Dish name */}
            <h2 className="font-display text-2xl font-bold leading-tight mb-2" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
              {primaryName}
            </h2>

            {/* Description */}
            {dish.description && (
              <p className="font-body text-sm leading-relaxed mb-4" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                {dish.description}
              </p>
            )}

            {/* Price */}
            <p className="font-body text-lg font-semibold mb-5" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
              ₹{dish.price}
            </p>

            {/* Add-ons section */}
            {addonProducts.length > 0 && (
              <div className="mb-5">
                <h3 className="font-body text-sm font-bold mb-3" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                  Add-ons
                </h3>
                <div className="flex flex-col gap-2">
                  {addonProducts.map((addon) => {
                    const selected = selectedAddons.has(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors duration-100 text-left"
                        style={{
                          borderColor: selected ? 'var(--sunday-accent, #b12d00)' : 'var(--sunday-border, #E8D5B0)',
                          backgroundColor: selected ? 'var(--sunday-surface-low, #f6f2e9)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                          style={{
                            borderColor: selected ? 'var(--sunday-accent, #b12d00)' : 'var(--sunday-border, #E8D5B0)',
                            backgroundColor: selected ? 'var(--sunday-accent, #b12d00)' : 'transparent',
                          }}
                        >
                          {selected && <Check size={12} strokeWidth={3} className="text-white" />}
                        </div>
                        <span className="flex-1 font-body text-sm font-medium" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                          {addon.name}
                        </span>
                        <span className="font-body text-sm font-semibold shrink-0" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                          +₹{addon.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Allergens */}
            {dish.allergens && dish.allergens.length > 0 && (
              <div className="mb-4">
                <span
                  className="font-body text-[11px] font-semibold rounded-full px-3 py-1"
                  style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text-muted, #7A6040)' }}
                >
                  Contains: {dish.allergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
                </span>
              </div>
            )}

            {/* Pairing suggestions */}
            <PairingSuggestions suggestions={suggestions} />
          </div>

          {/* Bottom add bar */}
          {dish.is_available ? (
            <div
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] border-t px-5 py-4 flex items-center gap-3 z-[101]"
              style={{
                backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                borderColor: 'var(--sunday-border, #E8D5B0)',
              }}
            >
              {/* Qty stepper */}
              <div
                className="flex items-center rounded-full overflow-hidden"
                style={{ border: '1px solid var(--sunday-border, #E8D5B0)' }}
              >
                <button
                  onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                  className="w-11 h-12 bg-transparent border-none text-xl font-light cursor-pointer flex items-center justify-center"
                  style={{ color: 'var(--sunday-text, #1c1c17)' }}
                >
                  −
                </button>
                <span className="w-8 text-center font-body text-base font-bold" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                  {localQty}
                </span>
                <button
                  onClick={() => setLocalQty((q) => q + 1)}
                  className="w-11 h-12 bg-transparent border-none text-xl font-light cursor-pointer flex items-center justify-center"
                  style={{ color: 'var(--sunday-text, #1c1c17)' }}
                >
                  +
                </button>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddToOrder}
                className="flex-1 py-4 rounded-full text-white font-body text-[15px] font-bold border-none cursor-pointer"
                style={{ background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }}
              >
                Add {localQty} item{localQty > 1 ? 's' : ''} · ₹{itemTotal}
              </button>
            </div>
          ) : (
            <div className="text-center font-body text-sm font-bold py-4" style={{ color: '#E23744' }}>
              Sold out
            </div>
          )}
        </div>
      </div>
    </>
  );
}
