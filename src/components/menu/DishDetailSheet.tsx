'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cdnImg } from '@/lib/utils';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

function VegBadge({ isVeg, veg, nonveg, cardBg }: { isVeg: boolean; veg: string; nonveg: string; cardBg: string }) {
  const color = isVeg ? veg : nonveg;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill={cardBg} />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  product: Product | null;
  tokens: MenuTokens;
  isBestseller?: boolean;
  lang?: 'en' | 'hi';
  onClose: () => void;
}

export default function DishDetailSheet({ product, tokens, isBestseller, lang = 'en', onClose }: Props) {
  const { items, addItem, updateQuantity, updateNotes } = useCart();
  const reduced = useReducedMotion();
  const [localQty, setLocalQty] = useState(1);
  const [notes, setNotes] = useState('');

  // ── Hero parallax ────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgOffset, setImgOffset] = useState(0);

  // ── Swipe to close ───────────────────────────────────────────────────
  const touchStartY = useRef(0);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  const animDoneRef = useRef(false);

  const handleSheetScroll = useCallback(() => {
    if (!scrollRef.current || reduced) return;
    setImgOffset(Math.min(scrollRef.current.scrollTop * 0.3, 18));
  }, [reduced]);

  function handleHandleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }

  function handleHandleTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      isDragging.current = true;
      setDragY(dy);
    }
  }

  function handleHandleTouchEnd() {
    if (dragY > 80) {
      onClose();
    } else {
      setDragY(0);
    }
    isDragging.current = false;
  }

  useEffect(() => {
    if (!product) return;
    setLocalQty(1);
    setImgOffset(0);
    setDragY(0);
    animDoneRef.current = false;
    const t = setTimeout(() => { animDoneRef.current = true; }, 460);
    const existing = items.find((i) => i.product_id === product.id);
    setNotes(existing?.notes ?? '');
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [product]);

  if (!product) return null;

  const dish = product;
  const cartItem = items.find((i) => i.product_id === dish.id);
  const cartQty = cartItem?.quantity ?? 0;
  const neonShadow = `${tokens.accent}1a`;

  // Language-aware name display
  const primaryName = (lang === 'hi' && dish.name_hindi) ? dish.name_hindi : dish.name;
  const secondaryName = (lang === 'hi' && dish.name_hindi) ? dish.name : null;

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
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .dish-notes-input::placeholder { opacity: 0.55; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backgroundColor: `rgba(0,0,0,${Math.max(0.2, 0.5 - dragY / 400)})`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          transition: dragY > 0 ? 'none' : 'background-color 0.2s ease',
        }}
      >
        <div
          ref={scrollRef}
          onClick={(e) => e.stopPropagation()}
          onScroll={handleSheetScroll}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: tokens.cardBg,
            borderRadius: '24px 24px 0 0',
            maxHeight: '85vh',
            overflowY: dragY > 0 ? 'hidden' : 'auto',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
            animation: reduced ? 'none' : 'sheetUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            position: 'relative',
            transform: sheetTransform,
            opacity: sheetOpacity,
            transition: dragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
          }}
        >
          {/* Drag handle — touch target for swipe to close */}
          <div
            style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px', cursor: 'grab', touchAction: 'none' }}
            onTouchStart={handleHandleTouchStart}
            onTouchMove={handleHandleTouchMove}
            onTouchEnd={handleHandleTouchEnd}
          >
            <div style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: tokens.border }} />
          </div>

          {/* X close button — 44×44 tap target */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: tokens.cardBg,
              color: tokens.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 8px rgba(0,0,0,0.12)`,
              zIndex: 2,
            }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>

          {/* Content */}
          <div style={{ padding: '4px 20px 32px' }}>
            {/* Photo with hero parallax */}
            {product.image_url && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 16,
                  boxShadow: `0 8px 32px ${tokens.text}14`,
                  position: 'relative',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cdnImg(product.image_url)!}
                  alt={product.name}
                  style={{
                    width: '100%',
                    height: '115%',
                    marginTop: '-7.5%',
                    objectFit: 'cover',
                    transform: reduced ? 'none' : `translateY(${-imgOffset}px)`,
                    willChange: 'transform',
                    transition: 'none',
                  }}
                />
              </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <VegBadge isVeg={product.is_veg} veg={tokens.veg} nonveg={tokens.nonveg} cardBg={tokens.cardBg} />
              {isBestseller && (
                <span style={{ backgroundColor: tokens.badgeBg, color: tokens.badgeText, fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 6px' }}>
                  🔥 Popular
                </span>
              )}
              {product.is_jain && (
                <span style={{ backgroundColor: tokens.bg, color: tokens.primary, fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 6px' }}>
                  JAIN
                </span>
              )}
            </div>

            {/* Dish name (language-aware) */}
            <div style={{ fontFamily: tokens.fontHeading, fontSize: 24, fontWeight: 700, color: tokens.text, lineHeight: 1.2 }}>
              {primaryName}
            </div>

            {/* Secondary name */}
            {secondaryName && (
              <div style={{ fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 500, color: tokens.textMuted, marginTop: 4 }}>
                {secondaryName}
              </div>
            )}

            {/* Hindi name when in English mode */}
            {lang === 'en' && product.name_hindi && (
              <div style={{ fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 500, color: tokens.textMuted, marginTop: 4 }}>
                {product.name_hindi}
              </div>
            )}

            {/* Price + spice */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: tokens.fontBody, fontSize: 22, fontWeight: 800, color: tokens.text }}>
                ₹{product.price}
              </span>
              {product.spice_level > 0 && (
                <span style={{ fontSize: 16 }}>{'🌶️'.repeat(product.spice_level)}</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div style={{ fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 400, color: tokens.textMuted, marginTop: 14, lineHeight: 1.65 }}>
                {product.description}
              </div>
            )}

            {/* Allergens */}
            {product.allergens && product.allergens.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontFamily: tokens.fontBody, fontSize: 11, fontWeight: 600, color: tokens.textMuted, backgroundColor: tokens.bg, borderRadius: 50, padding: '3px 10px' }}>
                  Contains: {product.allergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
                </span>
              </div>
            )}

            {/* Special instructions */}
            {product.is_available && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: tokens.fontBody, fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Special Instructions
                </div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. less spicy, no onion, extra sauce…"
                  className="dish-notes-input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${tokens.border}`,
                    backgroundColor: tokens.bg,
                    color: tokens.text,
                    fontFamily: tokens.fontBody,
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  } as React.CSSProperties}
                />
              </div>
            )}

            <div style={{ marginTop: 24 }} />

            {/* Action row */}
            {product.is_available ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Qty control */}
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: tokens.bg }}>
                  <button
                    onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                    style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: tokens.textMuted, fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >−</button>
                  <span style={{ width: 40, textAlign: 'center', fontFamily: tokens.fontBody, fontSize: 18, fontWeight: 800, color: tokens.text }}>
                    {localQty}
                  </span>
                  <button
                    onClick={() => setLocalQty((q) => q + 1)}
                    style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: tokens.textMuted, fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>

                {/* Add to order */}
                <button
                  onClick={handleAddToOrder}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 24,
                    background: tokens.ctaGradient,
                    color: '#fff',
                    fontFamily: tokens.fontBody,
                    fontSize: 16,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: `0 4px 20px ${neonShadow}`,
                  }}
                >
                  Add to order · ₹{product.price * localQty}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: tokens.error, fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 700, padding: '12px 0' }}>
                Sold out
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
