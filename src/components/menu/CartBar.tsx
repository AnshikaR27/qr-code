'use client';

import { useRef, useEffect, useState } from 'react';
import { formatPrice, getContrastText } from '@/lib/utils';

interface Props {
  view: 'browser' | 'list';
  itemCount: number;
  total: number;
  primaryColor: string;
  onOpen: () => void;
}

export default function CartBar({ view, itemCount, total, primaryColor, onOpen }: Props) {
  const prevCountRef = useRef(0);
  const [visible, setVisible] = useState(itemCount > 0);
  const [animate, setAnimate] = useState(false);
  const textColor = getContrastText(primaryColor);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (itemCount > 0 && prev === 0) {
      setVisible(true);
      setAnimate(true);
      setTimeout(() => setAnimate(false), 600);
    } else if (itemCount === 0) {
      setVisible(false);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const hex = primaryColor.startsWith('#') ? primaryColor.slice(1) : primaryColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  if (!visible) return null;

  if (view === 'browser') {
    // Floating bag icon bottom-right
    return (
      <>
        <style>{`
          @keyframes cartBounce {
            0%   { transform: translateY(100%) scale(0.8); }
            60%  { transform: translateY(-4px) scale(1.05); }
            100% { transform: translateY(0) scale(1); }
          }
        `}</style>
        <button
          onClick={onOpen}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 16,
            zIndex: 50,
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: primaryColor,
            color: textColor,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px rgba(${r},${g},${b},0.4)`,
            animation: animate ? 'cartBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
          }}
          aria-label="Open cart"
        >
          {/* Shopping bag */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {/* Badge */}
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: '#FF6B00',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {itemCount}
          </span>
        </button>
      </>
    );
  }

  // View 2 — full-width bar
  return (
    <>
      <style>{`
        @keyframes cartBounce {
          0%   { transform: translateY(100%); }
          60%  { transform: translateY(-4px); }
          100% { transform: translateY(0); }
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
          padding: '8px 16px 16px',
          pointerEvents: 'none',
        }}
      >
        {/* Frost backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(255,255,255,0.95) 60%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <button
          onClick={onOpen}
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: primaryColor,
            color: textColor,
            boxShadow: `0 4px 20px rgba(${r},${g},${b},0.3)`,
            pointerEvents: 'auto',
            animation: animate ? 'cartBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {itemCount}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700 }}>
              View Cart
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800 }}>
            {formatPrice(total)}
          </span>
        </button>
      </div>
    </>
  );
}
