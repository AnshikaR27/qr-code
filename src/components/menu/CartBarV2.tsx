'use client';

import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';

interface Props {
  tokens: MenuTokens;
  itemCount: number;
  total: number;
  onOpen: () => void;
}

/** Animates a number from its previous value to `target`. */
function useAnimatedNumber(target: number, duration = 400): number {
  const reduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) { setDisplayed(target); prevRef.current = target; return; }
    const start = prevRef.current;
    const end = target;
    if (start === end) return;
    const startTime = performance.now();
    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, reduced]);

  return displayed;
}

export default function CartBarV2({ tokens, itemCount, total, onOpen }: Props) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);
  const animatedTotal = useAnimatedNumber(total);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (itemCount === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideUpCartV2 {
          from { transform: translateX(-50%) translateY(110%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 420,
          zIndex: 50,
          padding: '10px 16px env(safe-area-inset-bottom, 16px)',
          animation: (!reduced && !entered)
            ? 'slideUpCartV2 0.4s cubic-bezier(0.32, 0.72, 0, 1) both'
            : 'none',
        }}
      >
        {/* Fade-out gradient behind bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(to top, ${tokens.bg} 50%, transparent)`,
            pointerEvents: 'none',
          }}
        />

        <button
          onClick={onOpen}
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: 999,
            backgroundColor: tokens.text,
            color: tokens.cardBg,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
        >
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: 15,
              fontWeight: 700,
              color: tokens.cardBg,
            }}
          >
            View your order
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 14,
                fontWeight: 600,
                color: `${tokens.cardBg}bb`,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ₹{animatedTotal}
            </span>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 900,
                color: tokens.cardBg,
              }}
            >
              {itemCount}
            </div>
          </div>
        </button>
      </div>
    </>
  );
}
