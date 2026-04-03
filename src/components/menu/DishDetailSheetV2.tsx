'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  tokens: MenuTokens;
  isBestseller?: boolean;
  lang?: 'en' | 'hi';
  onClose: () => void;
}

export default function DishDetailSheetV2({
  product,
  tokens,
  isBestseller,
  lang = 'en',
  onClose,
}: Props) {
  const { items, addItem, updateQuantity, updateNotes } = useCart();
  const reduced = useReducedMotion();
  const [localQty, setLocalQty] = useState(1);
  const [notes, setNotes] = useState('');

  // Swipe-to-close
  const touchStartY = useRef(0);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);

  // Parallax scroll on hero image
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
    const existing = items.find((i) => i.product_id === product.id);
    setNotes(existing?.notes ?? '');
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
  const primaryName = (lang === 'hi' && dish.name_hindi) ? dish.name_hindi : dish.name;
  const vegColor = dish.is_veg ? tokens.veg : tokens.nonveg;

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
        @keyframes sheetUpV2 {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .notes-input-v2::placeholder { opacity: 0.5; }
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
            borderRadius: '20px 20px 0 0',
            maxHeight: '90vh',
            overflowY: dragY > 0 ? 'hidden' : 'auto',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
            animation: reduced ? 'none' : 'sheetUpV2 0.4s cubic-bezier(0.32, 0.72, 0, 1) both',
            position: 'relative',
            transform: sheetTransform,
            opacity: sheetOpacity,
            transition: dragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 4px',
              touchAction: 'none',
              cursor: 'grab',
            }}
            onTouchStart={handleHandleTouchStart}
            onTouchMove={handleHandleTouchMove}
            onTouchEnd={handleHandleTouchEnd}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: dish.image_url ? 'rgba(255,255,255,0.5)' : tokens.border,
              }}
            />
          </div>

          {/* Back / close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 11,
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: dish.image_url ? 'rgba(255,255,255,0.9)' : `${tokens.text}12`,
              color: tokens.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: dish.image_url ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          {/* Hero image — full-width, no padding */}
          {dish.image_url && (
            <div
              style={{
                width: '100%',
                aspectRatio: '4/3',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dish.image_url}
                alt={dish.name}
                style={{
                  width: '100%',
                  height: '115%',
                  marginTop: '-7.5%',
                  objectFit: 'cover',
                  transform: reduced ? 'none' : `translateY(${-imgOffset}px)`,
                  willChange: 'transform',
                  transition: 'none',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Content */}
          <div style={{ padding: dish.image_url ? '18px 20px 36px' : '48px 20px 36px' }}>

            {/* Orderable badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: vegColor,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 12,
                  color: tokens.textMuted,
                  fontWeight: 500,
                }}
              >
                {dish.is_available ? (dish.is_veg ? 'Veg' : 'Non-veg') : 'Sold out'}
              </span>
              {isBestseller && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: tokens.badgeText,
                    backgroundColor: tokens.badgeBg,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  🔥 Popular
                </span>
              )}
              {dish.is_jain && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: tokens.primary,
                    backgroundColor: tokens.surfaceLow,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  JAIN
                </span>
              )}
            </div>

            {/* Dish name */}
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 24,
                fontWeight: 800,
                color: tokens.text,
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              {primaryName}
              {dish.spice_level > 0 && (
                <span style={{ marginLeft: 8, fontSize: 18 }}>
                  {'🌶️'.repeat(dish.spice_level)}
                </span>
              )}
            </div>

            {/* Description */}
            {dish.description && (
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  color: tokens.textMuted,
                  lineHeight: 1.65,
                  marginBottom: 14,
                }}
              >
                {dish.description}
              </div>
            )}

            {/* Price */}
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 22,
                fontWeight: 800,
                color: tokens.text,
                marginBottom: 20,
              }}
            >
              ₹{dish.price}
            </div>

            {/* Allergens */}
            {dish.allergens && dish.allergens.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 11,
                    fontWeight: 600,
                    color: tokens.textMuted,
                    backgroundColor: tokens.surfaceLow,
                    borderRadius: 50,
                    padding: '3px 10px',
                  }}
                >
                  Contains:{' '}
                  {dish.allergens
                    .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
                    .join(', ')}
                </span>
              </div>
            )}

            {/* Special instructions */}
            {dish.is_available && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 12,
                    fontWeight: 700,
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  Special instructions
                </div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. less spicy, no onion…"
                  className="notes-input-v2"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
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

            {/* Action row */}
            {dish.is_available ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Qty stepper */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: `1.5px solid ${tokens.border}`,
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                    style={{
                      width: 44,
                      height: 50,
                      background: 'transparent',
                      border: 'none',
                      color: tokens.text,
                      fontSize: 20,
                      fontWeight: 300,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      width: 32,
                      textAlign: 'center',
                      fontFamily: tokens.fontBody,
                      fontSize: 16,
                      fontWeight: 700,
                      color: tokens.text,
                    }}
                  >
                    {localQty}
                  </span>
                  <button
                    onClick={() => setLocalQty((q) => q + 1)}
                    style={{
                      width: 44,
                      height: 50,
                      background: 'transparent',
                      border: 'none',
                      color: tokens.text,
                      fontSize: 20,
                      fontWeight: 300,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Add to order button */}
                <button
                  onClick={handleAddToOrder}
                  style={{
                    flex: 1,
                    padding: '16px 0',
                    borderRadius: 999,
                    backgroundColor: tokens.text,
                    color: tokens.cardBg,
                    fontFamily: tokens.fontBody,
                    fontSize: 15,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Add {localQty} item{localQty > 1 ? 's' : ''} · ₹{dish.price * localQty}
                </button>
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: tokens.error,
                  fontFamily: tokens.fontBody,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '14px 0',
                }}
              >
                Sold out
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
