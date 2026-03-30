'use client';

import { useRef, useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';
import type { Product } from '@/types';

// Fixed widths for the morphing button container
const ADD_W = 88;
const STEP_W = 104;

// Burst directions (radians): spread mostly upward with slight randomness
const BURST = [
  (255 * Math.PI) / 180,
  (290 * Math.PI) / 180,
  (320 * Math.PI) / 180,
  (55 * Math.PI) / 180,
];

function VegBadge({ isVeg, veg, nonveg, cardBg }: { isVeg: boolean; veg: string; nonveg: string; cardBg: string }) {
  const color = isVeg ? veg : nonveg;
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      {/* fill uses cardBg not "white" so it's visible on dark card surfaces */}
      <rect x="1" y="1" width="16" height="16" rx="2" stroke={color} strokeWidth="2" fill={cardBg} />
      <circle cx="9" cy="9" r="4.5" fill={color} />
    </svg>
  );
}

interface Props {
  dish: Product;
  tokens: MenuTokens;
  index: number;
  isBestseller: boolean;
  lang?: 'en' | 'hi';
  onTap: () => void;
}

export default function DishCard({ dish, tokens, index, isBestseller, lang = 'en', onTap }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const reduced = useReducedMotion();

  // ── Scroll reveal ────────────────────────────────────────────────────
  const outerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reduced) { setRevealed(true); return; }
    const el = outerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  const staggerDelay = reduced ? 0 : Math.min(index, 5) * 50;

  // ── Magnetic button state ────────────────────────────────────────────
  const [addHovered, setAddHovered] = useState(false);
  const [addPressed, setAddPressed] = useState(false);

  // ── Celebration particles ────────────────────────────────────────────
  const [particles, setParticles] = useState<Array<{ id: number; tx: number; ty: number }>>([]);

  const cartItem = items.find((i) => i.product_id === dish.id);
  const qty = cartItem?.quantity ?? 0;

  // Language-aware primary name
  const primaryName = (lang === 'hi' && dish.name_hindi) ? dish.name_hindi : dish.name;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    addItem(dish);
    if (!reduced) spawnParticles();
  }

  function spawnParticles() {
    const ps = BURST.map((rad, i) => ({
      id: Date.now() + i,
      tx: Math.cos(rad) * 26,
      ty: Math.sin(rad) * 26,
    }));
    setParticles(ps);
    setTimeout(() => setParticles([]), 600);
  }

  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty + 1);
  }

  function handleDecrease(e: React.MouseEvent) {
    e.stopPropagation();
    updateQuantity(dish.id, qty - 1);
  }

  // Inner card tap scale (separate from reveal so durations don't conflict)
  function tapDown(e: React.MouseEvent | React.TouchEvent) {
    (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
  }
  function tapUp(e: React.MouseEvent | React.TouchEvent) {
    (e.currentTarget as HTMLElement).style.transform = '';
  }

  const addBtnTransform = addPressed ? 'scale(0.95)' : addHovered ? 'scale(1.05)' : 'scale(1)';
  // Max 10% opacity (1a) on all accent glows — keeps effect subtle on any theme color
  const addBtnShadow = addHovered && !addPressed
    ? `0 6px 20px ${tokens.primary}1a`
    : `0 4px 16px ${tokens.primary}1a`;

  return (
    // Outer wrapper — owns the scroll-reveal opacity/translateY
    <div
      ref={outerRef}
      style={{
        margin: '0 16px 16px',
        opacity: revealed ? (dish.is_available ? 1 : 0.4) : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(20px)',
        transition: reduced
          ? 'none'
          : `opacity 400ms ease-out ${staggerDelay}ms, transform 400ms ease-out ${staggerDelay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {/* Inner card — owns the tap-scale micro-interaction */}
      <div
        onClick={dish.is_available ? onTap : undefined}
        onMouseDown={dish.is_available ? tapDown : undefined}
        onMouseUp={dish.is_available ? tapUp : undefined}
        onMouseLeave={dish.is_available ? tapUp : undefined}
        onTouchStart={dish.is_available ? tapDown : undefined}
        onTouchEnd={dish.is_available ? tapUp : undefined}
        style={{
          borderRadius: 16,
          border: `1.5px solid ${tokens.border}`,
          backgroundColor: tokens.cardBg,
          overflow: 'hidden',
          cursor: dish.is_available ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'row',
          minHeight: 168,
          transition: 'transform 0.12s ease',
          willChange: 'transform',
        }}
      >
        {/* Image — bleeds to left/top/bottom card edges (or placeholder if no image) */}
        <div
          style={{
            width: 112,
            alignSelf: 'stretch',
            flexShrink: 0,
            borderRadius: '14.5px 0 0 14.5px',
            overflow: 'hidden',
            backgroundColor: dish.image_url ? undefined : `${tokens.primary}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dish.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.image_url}
              alt={dish.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Utensils size={28} color={tokens.primary} strokeWidth={1.5} />
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top */}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <div style={{ paddingTop: 2 }}>
                <VegBadge isVeg={dish.is_veg} veg={tokens.veg} nonveg={tokens.nonveg} cardBg={tokens.cardBg} />
              </div>
              <span
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 16,
                  fontWeight: 700,
                  color: tokens.text,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}
              >
                {primaryName}
              </span>
            </div>

            {(isBestseller || dish.is_jain) && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                {isBestseller && (
                  <span style={{ backgroundColor: tokens.badgeBg, color: tokens.badgeText, fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 6px' }}>
                    🔥 Popular
                  </span>
                )}
                {dish.is_jain && (
                  <span style={{ backgroundColor: tokens.surfaceLow, color: tokens.primary, fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 6px' }}>
                    JAIN
                  </span>
                )}
              </div>
            )}

            {lang === 'hi' && dish.name_hindi ? (
              <div style={{ fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 500, color: tokens.textMuted, marginBottom: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {dish.name}
              </div>
            ) : dish.name_hindi ? (
              <div style={{ fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 500, color: tokens.textMuted, marginBottom: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {dish.name_hindi}
              </div>
            ) : null}

            {dish.description && (
              <div
                style={{
                  fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 400, color: tokens.textMuted,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}
              >
                {dish.description}
              </div>
            )}
          </div>

          {/* Price + morphing button row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
            {dish.is_available ? (
              <span style={{ fontFamily: tokens.fontBody, fontSize: 16, fontWeight: 800, color: tokens.text }}>
                ₹{dish.price}
                {dish.spice_level > 0 && <span style={{ marginLeft: 4, fontSize: 12 }}>{'🌶️'.repeat(dish.spice_level)}</span>}
              </span>
            ) : (
              <span style={{ fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700, color: tokens.error }}>Sold out</span>
            )}

            {dish.is_available && (
              /* ── Button morph container ─────────────────────────────── */
              <div
                style={{
                  position: 'relative',
                  width: qty === 0 ? ADD_W : STEP_W,
                  height: 36,
                  flexShrink: 0,
                  transition: reduced ? 'none' : 'width 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'width',
                }}
              >
                {/* Celebration particles */}
                {particles.map((p) => (
                  <div
                    key={p.id}
                    className="menu-particle"
                    style={{
                      position: 'absolute',
                      left: '50%', top: '50%',
                      width: 7, height: 7,
                      marginLeft: -3.5, marginTop: -3.5,
                      borderRadius: '50%',
                      backgroundColor: tokens.accent,
                      pointerEvents: 'none',
                      zIndex: 10,
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                    } as React.CSSProperties}
                  />
                ))}

                {/* Add button — fades out when qty > 0 */}
                <button
                  onClick={handleAdd}
                  onMouseEnter={() => { setAddHovered(true); setAddPressed(false); }}
                  onMouseLeave={() => { setAddHovered(false); setAddPressed(false); }}
                  onFocus={() => setAddHovered(true)}
                  onBlur={() => { setAddHovered(false); setAddPressed(false); }}
                  onMouseDown={(e) => { e.stopPropagation(); setAddPressed(true); }}
                  onMouseUp={() => setAddPressed(false)}
                  onTouchStart={(e) => { e.stopPropagation(); setAddPressed(true); }}
                  onTouchEnd={(e) => { e.stopPropagation(); setAddPressed(false); }}
                  style={{
                    position: 'absolute', inset: 0,
                    opacity: qty === 0 ? 1 : 0,
                    pointerEvents: qty === 0 ? 'auto' : 'none',
                    transition: reduced ? 'none' : 'opacity 150ms ease, transform 200ms ease, box-shadow 200ms ease',
                    willChange: 'opacity, transform',
                    background: tokens.ctaGradient,
                    color: '#fff',
                    fontFamily: tokens.fontBody,
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 24,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: addBtnShadow,
                    transform: addBtnTransform,
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  ⊕ Add
                </button>

                {/* Stepper — fades in when qty > 0 */}
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    opacity: qty > 0 ? 1 : 0,
                    pointerEvents: qty > 0 ? 'auto' : 'none',
                    transition: reduced ? 'none' : 'opacity 150ms ease',
                    willChange: 'opacity',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: tokens.success,
                    borderRadius: 24,
                    boxShadow: `0 4px 16px ${tokens.success}1a`,
                  }}
                >
                  <button
                    onClick={handleDecrease}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, fontSize: 18, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  >−</button>
                  <span style={{ color: '#fff', fontWeight: 800, fontFamily: tokens.fontBody, fontSize: 14, flex: 1, textAlign: 'center' }}>
                    {qty}
                  </span>
                  <button
                    onClick={handleIncrease}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, fontSize: 18, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  >+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
