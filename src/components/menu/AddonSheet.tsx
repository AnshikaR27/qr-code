'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, Utensils } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getAddonGroupsForProduct } from '@/lib/addon-utils';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
import type { AddonGroup, Product, SelectedAddon } from '@/types';

interface Props {
  product: Product | null;
  onClose: () => void;
  preloadedGroups?: AddonGroup[];
}

/**
 * Zomato-style add-on customization bottom sheet.
 *
 * Opening logic (controlled by parent):
 *  - If product has NO addon groups → parent should call useCart().addItem() directly
 *  - If product HAS addon groups    → parent shows this sheet
 *
 * The sheet lets the customer pick add-ons, set quantity, then adds to cart.
 */
export default function AddonSheet({ product, onClose, preloadedGroups }: Props) {
  const { addItem } = useCart();

  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // selections: groupId → Set of selected addon_item_ids
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [qty, setQty] = useState(1);

  // Swipe-to-close
  const [dragY, setDragY] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  // Use preloaded groups when available (server-fetched, bypasses RLS for anonymous customers).
  // Fall back to a client-side fetch only if no preloaded data was passed.
  useEffect(() => {
    if (!product) return;
    setSelections({});
    setQty(1);
    setDragY(0);

    if (preloadedGroups) {
      setAddonGroups(preloadedGroups);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    getAddonGroupsForProduct(supabase, product.id, product.category_id ?? null)
      .then((groups) => setAddonGroups(groups))
      .catch(() => setAddonGroups([]))
      .finally(() => setLoading(false));
  }, [product?.id, preloadedGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 0) setDragY(dy);
  }, [touchStartY]);

  const handleTouchEnd = useCallback(() => {
    if (dragY > 80) { setDragY(0); onClose(); }
    else setDragY(0);
  }, [dragY, onClose]);

  if (!product) return null;

  // ── Selection toggles ─────────────────────────────────────────────────────

  function toggleItem(group: AddonGroup, itemId: string) {
    setSelections((prev) => {
      const current = new Set(prev[group.id] ?? []);

      if (group.selection_type === 'radio') {
        // Radio: always exactly one selection
        return { ...prev, [group.id]: new Set([itemId]) };
      }

      // Checkbox
      if (current.has(itemId)) {
        current.delete(itemId);
      } else {
        // Respect max_selections
        if (group.max_selections !== null && current.size >= group.max_selections) {
          return prev; // silently ignore (UI shows grayed state)
        }
        current.add(itemId);
      }
      return { ...prev, [group.id]: new Set(current) };
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const allRequiredSatisfied = addonGroups
    .filter((g) => g.is_required)
    .every((g) => {
      const sel = selections[g.id];
      return sel && sel.size > 0;
    });

  // ── Price calculation ─────────────────────────────────────────────────────

  const selectedAddonTotal = addonGroups.reduce((sum, group) => {
    const sel = selections[group.id];
    if (!sel) return sum;
    return sum + group.items
      .filter((item) => sel.has(item.id))
      .reduce((s, item) => s + item.price, 0);
  }, 0);

  const itemTotal = (product.price + selectedAddonTotal) * qty;

  // ── Add to cart ───────────────────────────────────────────────────────────

  function handleAddToCart() {
    if (!allRequiredSatisfied || !product) return;

    const selectedAddons: SelectedAddon[] = addonGroups.flatMap((group) => {
      const sel = selections[group.id];
      if (!sel) return [];
      return group.items
        .filter((item) => sel.has(item.id))
        .map((item) => ({
          addon_item_id: item.id,
          name: item.name,
          price: item.price,
        }));
    });

    // Add qty times
    for (let i = 0; i < qty; i++) {
      addItem(product, [], selectedAddons);
    }

    navigator.vibrate?.(50);
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sheetTransform = dragY > 0 ? `translateY(${dragY}px)` : 'translateY(0)';
  const sheetOpacity  = dragY > 50 ? Math.max(0.4, 1 - (dragY - 50) / 200) : 1;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.2, 0.5 - dragY / 400)})` }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] max-h-[90vh] flex flex-col sunday-slide-up"
        style={{
          borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5) calc(var(--sunday-radius, 12px) * 1.5) 0 0',
          backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
          transform: sheetTransform,
          opacity: sheetOpacity,
          transition: dragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2.5 pb-1 touch-none cursor-grab shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="w-9 h-1 rounded-full"
            style={{ backgroundColor: 'var(--sunday-border, #E8D5B0)' }}
          />
        </div>

        {/* Header: close button + dish info */}
        <div
          className="flex items-start gap-3 shrink-0 border-b"
          style={{
            paddingLeft: spacingScale.px,
            paddingRight: spacingScale.px,
            paddingBottom: spacingScale.cardPad,
            borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
          }}
        >
          {/* Dish image */}
          <div
            className="overflow-hidden flex items-center justify-center shrink-0"
            style={{
              width: sizeScale.cartThumb,
              height: sizeScale.cartThumb,
              borderRadius: 'var(--sunday-radius, 12px)',
              backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
            }}
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Utensils size={22} strokeWidth={1.5} style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
            )}
          </div>

          {/* Name + base price */}
          <div className="flex-1 min-w-0">
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
            >
              {product.name}
            </h2>
            <p
              className="mt-0.5"
              style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
            >
              {formatPrice(product.price)}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close customization"
            className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)', color: 'var(--sunday-text, #1c1c17)' }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body — addon groups */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)', fontSize: typeScale.sm }}
            >
              Loading options…
            </div>
          ) : addonGroups.length === 0 ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)', fontSize: typeScale.sm }}
            >
              No customization options
            </div>
          ) : (
            addonGroups.map((group) => {
              const sel = selections[group.id] ?? new Set<string>();
              const atMax = group.selection_type === 'checkbox' &&
                group.max_selections !== null &&
                sel.size >= group.max_selections;

              return (
                <div
                  key={group.id}
                  className="border-b"
                  style={{
                    paddingLeft: spacingScale.px,
                    paddingRight: spacingScale.px,
                    paddingTop: spacingScale.cardPad,
                    paddingBottom: spacingScale.cardPad,
                    borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
                  }}
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <h3
                      className="font-bold"
                      style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
                    >
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {group.is_required ? (
                        <span
                          className="font-semibold px-2 py-0.5"
                          style={{
                            fontSize: typeScale.xs,
                            borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                            backgroundColor: 'color-mix(in srgb, var(--sunday-accent, #b12d00) 12%, var(--sunday-card-bg, #FFFFFF))',
                            color: 'var(--sunday-accent, #b12d00)',
                            fontFamily: 'var(--sunday-font-body)',
                          }}
                        >
                          Required
                        </span>
                      ) : (
                        <span
                          className="font-semibold px-2 py-0.5"
                          style={{
                            fontSize: typeScale.xs,
                            borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                            backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                            color: 'var(--sunday-text-muted, #7A6040)',
                            fontFamily: 'var(--sunday-font-body)',
                          }}
                        >
                          Optional
                        </span>
                      )}
                      {group.selection_type === 'checkbox' && group.max_selections !== null && (
                        <span
                          style={{
                            fontSize: typeScale.xs,
                            color: 'var(--sunday-text-muted, #7A6040)',
                            fontFamily: 'var(--sunday-font-body)',
                          }}
                        >
                          (max {group.max_selections})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Addon items */}
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => {
                      const isSelected = sel.has(item.id);
                      const isDisabled = !item.is_available || (!isSelected && atMax);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && toggleItem(group, item.id)}
                          className="flex items-center gap-2.5 text-left transition-all duration-100 active:scale-[0.98]"
                          style={{
                            padding: spacingScale.cardPad,
                            borderRadius: 'var(--sunday-radius, 12px)',
                            border: `1px solid ${isSelected
                              ? 'var(--sunday-accent, #b12d00)'
                              : 'var(--sunday-border, #E8D5B0)'}`,
                            backgroundColor: isSelected
                              ? 'color-mix(in srgb, var(--sunday-accent, #b12d00) 8%, transparent)'
                              : 'transparent',
                            opacity: isDisabled ? 0.45 : 1,
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {/* Veg / non-veg indicator dot */}
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: item.is_veg
                                ? 'var(--sunday-veg, #0F8A00)'
                                : 'var(--sunday-nonveg, #E23744)',
                            }}
                          />

                          {/* Radio / checkbox indicator */}
                          {group.selection_type === 'radio' ? (
                            <div
                              className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                              style={{
                                borderColor: isSelected
                                  ? 'var(--sunday-accent, #b12d00)'
                                  : 'var(--sunday-border, #E8D5B0)',
                              }}
                            >
                              {isSelected && (
                                <div
                                  className="w-2 h-2 rounded-full animate-check-pop"
                                  style={{ backgroundColor: 'var(--sunday-accent, #b12d00)' }}
                                />
                              )}
                            </div>
                          ) : (
                            <div
                              className="w-4 h-4 border-2 flex items-center justify-center shrink-0"
                              style={{
                                borderRadius: 'calc(var(--sunday-radius, 12px) * 0.33)',
                                borderColor: isSelected
                                  ? 'var(--sunday-accent, #b12d00)'
                                  : 'var(--sunday-border, #E8D5B0)',
                                backgroundColor: isSelected
                                  ? 'var(--sunday-accent, #b12d00)'
                                  : 'transparent',
                              }}
                            >
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="animate-check-pop">
                                  <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          )}

                          {/* Name */}
                          <span
                            className="flex-1 font-medium"
                            style={{
                              fontSize: typeScale.sm,
                              color: 'var(--sunday-text, #1c1c17)',
                              fontFamily: 'var(--sunday-font-body)',
                            }}
                          >
                            {item.name}
                            {!item.is_available && (
                              <span
                                className="ml-1.5"
                                style={{ fontSize: typeScale.xs, color: 'var(--sunday-nonveg, #E23744)' }}
                              >
                                (unavailable)
                              </span>
                            )}
                          </span>

                          {/* Price */}
                          <span
                            className="font-semibold shrink-0"
                            style={{
                              fontSize: typeScale.sm,
                              color: 'var(--sunday-text-muted, #7A6040)',
                              fontFamily: 'var(--sunday-font-body)',
                            }}
                          >
                            {item.price === 0 ? 'Included' : `+${formatPrice(item.price)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky footer: qty + total + add button */}
        <div
          className="shrink-0 border-t"
          style={{
            paddingLeft: spacingScale.px,
            paddingRight: spacingScale.px,
            paddingTop: spacingScale.cardPad,
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
            borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Qty stepper */}
            <div
              className="flex items-center overflow-hidden shrink-0"
              style={{
                borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                border: '1px solid var(--sunday-border, #E8D5B0)',
                backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
              }}
            >
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                className="bg-transparent border-none font-light cursor-pointer flex items-center justify-center"
                style={{
                  width: sizeScale.stepperW,
                  height: sizeScale.stepperH,
                  fontSize: typeScale.xl,
                  color: 'var(--sunday-text, #1c1c17)',
                  opacity: qty <= 1 ? 0.35 : 1,
                }}
              >
                <Minus size={14} strokeWidth={2.5} />
              </button>
              <span
                className="w-7 text-center font-bold"
                style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
              >
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
                className="bg-transparent border-none font-light cursor-pointer flex items-center justify-center"
                style={{
                  width: sizeScale.stepperW,
                  height: sizeScale.stepperH,
                  fontSize: typeScale.xl,
                  color: 'var(--sunday-text, #1c1c17)',
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* Add to cart button */}
            <button
              onClick={handleAddToCart}
              disabled={!allRequiredSatisfied || loading}
              className="flex-1 py-3 text-white font-bold border-none cursor-pointer active:scale-[0.98] transition-transform duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                fontSize: typeScale.md,
                borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))`,
                boxShadow: 'var(--sunday-shadow-md)',
                fontFamily: 'var(--sunday-font-body)',
              }}
            >
              {allRequiredSatisfied
                ? `Add to cart · ${formatPrice(itemTotal)}`
                : 'Select required options'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
