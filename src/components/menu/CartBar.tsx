'use client';

import { useState, useEffect } from 'react';
import type { MenuTokens } from '@/lib/tokens';

interface Props {
  tokens: MenuTokens;
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export default function CartBar({ tokens, itemCount, total, onOpen }: Props) {
  const [entered, setEntered] = useState(false);
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
          60%  { transform: translateX(-50%) translateY(-6px); opacity: 1; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
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
          animation: entered
            ? 'none'
            : 'slideUpCart 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Frost backdrop — gradient fade into bg */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(to top, ${tokens.bg} 55%, transparent)`,
            pointerEvents: 'none',
          }}
        />

        {/* Bar */}
        <button
          onClick={onOpen}
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: 24,
            background: tokens.ctaGradient,
            color: '#fff',
            // Ambient shadow: tinted from on_surface, diffused — per DESIGN.md
            boxShadow: `0 -4px 40px -10px ${tokens.text}1a, 0 6px 28px ${tokens.primary}45`,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {/* Left: count badge + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 900,
                color: '#fff',
              }}
            >
              {itemCount}
            </div>
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              View Cart
            </span>
          </div>

          {/* Right: total */}
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: 18,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            ₹{total}
          </span>
        </button>
      </div>
    </>
  );
}
