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

/** Animates a number from its previous value to `target` using rAF + easeOut. */
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
      const eased = 1 - Math.pow(1 - t, 3); // cubic easeOut
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

export default function CartBar({ tokens, itemCount, total, onOpen }: Props) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);
  const animatedTotal = useAnimatedNumber(total);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 450);
    return () => clearTimeout(t);
  }, []);

  if (itemCount === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideUpCart {
          from { transform: translateX(-50%) translateY(110%); opacity: 0; }
          60%  { transform: translateX(-50%) translateY(-6px);  opacity: 1; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
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
          padding: '8px 16px env(safe-area-inset-bottom, 16px)',
          animation: (!reduced && !entered)
            ? 'slideUpCart 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both'
            : 'none',
        }}
      >
        {/* Frost fade into page bg */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
            background: `linear-gradient(to top, ${tokens.bg} 55%, transparent)`,
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
            borderRadius: 24,
            background: tokens.ctaGradient,
            color: '#fff',
            boxShadow: `0 -4px 40px -10px ${tokens.text}1a, 0 6px 28px ${tokens.primary}45`,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 900, color: '#fff',
              }}
            >
              {itemCount}
            </div>
            <span style={{ fontFamily: tokens.fontBody, fontSize: 15, fontWeight: 700, color: '#fff' }}>
              View Cart
            </span>
          </div>

          {/* Price ticker */}
          <span
            style={{
              fontFamily: tokens.fontBody, fontSize: 18, fontWeight: 800, color: '#fff',
              fontVariantNumeric: 'tabular-nums',
              willChange: 'contents',
            }}
          >
            ₹{animatedTotal}
          </span>
        </button>
      </div>
    </>
  );
}
