'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Utensils, Check, MessageSquare, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatPrice, cdnImg } from '@/lib/utils';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
import type { Product, Category, CartAddon } from '@/types';

interface Props {
  product: Product | null;
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
  const [showNotes, setShowNotes] = useState(false);
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
    const existingNotes = existing?.notes ?? '';
    setNotes(existingNotes);
    setShowNotes(existingNotes.length > 0);
    setSelectedAddons(new Set((existing?.addons ?? []).map((a) => a.product_id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  useEffect(() => {
    if (!product) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);


  if (!product) return null;

  const dish = product;
  // For the detail sheet we work with the first cart line for this product
  // (there may be multiple lines if the dish has addon variants)
  const cartItem = items.find((i) => i.product_id === dish.id);
  const cartKey  = cartItem?.cart_key ?? dish.id;
  const cartQty  = cartItem?.quantity ?? 0;
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
      updateQuantity(cartKey, cartQty + localQty);
      updateAddons(cartKey, addons);
    }
    updateNotes(cartKey, notes.trim());
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
          className={`w-full max-w-[480px] max-h-[90vh] overflow-y-auto relative ${
            reduced ? '' : 'sunday-slide-up'
          }`}
          style={{
            borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5) calc(var(--sunday-radius, 12px) * 1.5) 0 0',
            backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
            overflowY: dragY > 0 ? 'hidden' : 'auto',
            transform: sheetTransform,
            opacity: sheetOpacity,
            transition: dragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
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
            aria-label="Close dish details"
            className="absolute top-3 left-3 z-[11] w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{
              ...(dish.image_url
                ? { background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }
                : { backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text, #1c1c17)' }),
              boxShadow: 'var(--sunday-shadow-md)',
            }}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          {/* Hero image */}
          {dish.image_url ? (
            <div className="w-full aspect-[16/9] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnImg(dish.image_url, 960, 540)}
                alt={dish.name}
                width={960}
                height={540}
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
          <div
            className="pb-32"
            style={{
              paddingTop: dish.image_url ? spacingScale.px : 'calc(40px + 4px)',
              paddingLeft: spacingScale.px,
              paddingRight: spacingScale.px,
            }}
          >
            {/* Orderable badge */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dish.is_available ? 'var(--sunday-veg, #0F8A00)' : 'var(--sunday-nonveg, #E23744)' }} />
              <span
                className="font-medium"
                style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
              >
                {dish.is_available ? 'Available' : 'Sold out'}
              </span>
              {isBestseller && (
                <span
                  className="font-bold px-1.5 py-0.5"
                  style={{
                    fontSize: typeScale.xs,
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 0.33)',
                    backgroundColor: 'var(--sunday-badge-bg, #C8991A)',
                    color: 'var(--sunday-badge-text, #ffffff)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                >
                  Popular
                </span>
              )}
              {dish.is_jain && (
                <span
                  className="font-bold px-1.5 py-0.5"
                  style={{
                    fontSize: typeScale.xs,
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 0.33)',
                    backgroundColor: 'var(--sunday-badge-bg, #C8991A)',
                    color: 'var(--sunday-badge-text, #ffffff)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                >
                  Jain
                </span>
              )}
            </div>

            {/* Dish name */}
            <h2
              className="font-bold leading-tight mb-2"
              style={{ fontSize: typeScale['2xl'], color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
            >
              {primaryName}
            </h2>

            {/* Description */}
            {dish.description && (
              <p
                className="leading-relaxed mb-4"
                style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
              >
                {dish.description}
              </p>
            )}

            {/* Price */}
            <p
              className="font-semibold mb-5"
              style={{ fontSize: typeScale.base, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
            >
              {formatPrice(dish.price)}
            </p>

            {/* Add-ons section */}
            {addonProducts.length > 0 && (
              <div className="mb-5">
                <h3
                  className="font-bold mb-3"
                  style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
                >
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
                        className="flex items-center gap-3 px-3.5 py-3 border transition-all duration-100 text-left active:scale-[0.98]"
                        style={{
                          borderRadius: 'var(--sunday-radius, 12px)',
                          borderColor: selected ? 'var(--sunday-accent, #b12d00)' : 'var(--sunday-border, #E8D5B0)',
                          backgroundColor: selected ? 'var(--sunday-surface-low, #f6f2e9)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-5 h-5 border-2 flex items-center justify-center shrink-0"
                          style={{
                            borderRadius: 'calc(var(--sunday-radius, 12px) * 0.33)',
                            borderColor: selected ? 'var(--sunday-accent, #b12d00)' : 'var(--sunday-border, #E8D5B0)',
                            backgroundColor: selected ? 'var(--sunday-accent, #b12d00)' : 'transparent',
                          }}
                        >
                          {selected && <Check size={12} strokeWidth={3} className="text-white" />}
                        </div>
                        <span
                          className="flex-1 font-medium"
                          style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          {addon.name}
                        </span>
                        <span
                          className="font-semibold shrink-0"
                          style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          +{formatPrice(addon.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special instructions */}
            {!showNotes ? (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="flex items-center gap-2 mb-5 border-none bg-transparent cursor-pointer active:opacity-70 transition-opacity"
                style={{ padding: 0 }}
              >
                <MessageSquare size={16} style={{ color: 'var(--sunday-accent, #b12d00)' }} />
                <span
                  className="font-medium"
                  style={{ fontSize: typeScale.sm, color: 'var(--sunday-accent, #b12d00)', fontFamily: 'var(--sunday-font-body)' }}
                >
                  Add a note
                </span>
              </button>
            ) : (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
                    <span
                      className="font-bold"
                      style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
                    >
                      Note to kitchen
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNotes(''); setShowNotes(false); }}
                    aria-label="Remove note"
                    className="p-1 rounded-full bg-transparent border-none cursor-pointer"
                    style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. less spicy, no onions…"
                  rows={2}
                  className="w-full resize-none outline-none border transition-colors"
                  style={{
                    fontSize: typeScale.sm,
                    padding: spacingScale.cardPad,
                    borderRadius: 'var(--sunday-radius, 12px)',
                    borderColor: 'var(--sunday-border, #E8D5B0)',
                    backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                    color: 'var(--sunday-text, #1c1c17)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                />
              </div>
            )}

            {/* Allergens */}
            {dish.allergens && dish.allergens.length > 0 && (
              <div className="mb-4">
                <span
                  className="font-semibold px-3 py-1"
                  style={{
                    fontSize: typeScale.xs,
                    borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                    backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                    color: 'var(--sunday-text-muted, #7A6040)',
                    fontFamily: 'var(--sunday-font-body)',
                  }}
                >
                  Contains: {dish.allergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
                </span>
              </div>
            )}

          </div>

          {/* Bottom add bar */}
          {dish.is_available ? (
            <div
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] border-t flex items-center gap-3 z-[101]"
              style={{
                paddingLeft: spacingScale.px,
                paddingRight: spacingScale.px,
                paddingTop: spacingScale.cardPad,
                paddingBottom: spacingScale.cardPad,
                backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
                boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
              }}
            >
              {/* Qty stepper */}
              <div
                className="flex items-center overflow-hidden"
                style={{
                  borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                  border: '1px solid var(--sunday-border, #E8D5B0)',
                }}
              >
                <button
                  onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  disabled={localQty <= 1}
                  className="bg-transparent border-none font-light cursor-pointer flex items-center justify-center"
                  style={{
                    width: sizeScale.stepperW,
                    height: sizeScale.stepperH,
                    fontSize: typeScale.xl,
                    color: 'var(--sunday-text, #1c1c17)',
                    opacity: localQty <= 1 ? 0.35 : 1,
                  }}
                >
                  −
                </button>
                <span
                  className="w-7 text-center font-bold"
                  style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                >
                  {localQty}
                </span>
                <button
                  onClick={() => setLocalQty((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="bg-transparent border-none font-light cursor-pointer flex items-center justify-center"
                  style={{
                    width: sizeScale.stepperW,
                    height: sizeScale.stepperH,
                    fontSize: typeScale.xl,
                    color: 'var(--sunday-text, #1c1c17)',
                  }}
                >
                  +
                </button>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddToOrder}
                aria-label={`Add ${localQty} ${primaryName} to order`}
                className="flex-1 py-3 text-white font-bold border-none cursor-pointer active:scale-[0.98] transition-transform duration-100"
                style={{
                  fontSize: typeScale.md,
                  borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                  background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))`,
                  boxShadow: 'var(--sunday-shadow-md)',
                  fontFamily: 'var(--sunday-font-body)',
                }}
              >
                Add {localQty} item{localQty > 1 ? 's' : ''} · {formatPrice(itemTotal)}
              </button>
            </div>
          ) : (
            <div
              className="text-center font-bold py-4"
              style={{ fontSize: typeScale.sm, color: 'var(--sunday-nonveg, #E23744)', fontFamily: 'var(--sunday-font-body)' }}
            >
              Sold out
            </div>
          )}
        </div>
      </div>
    </>
  );
}
