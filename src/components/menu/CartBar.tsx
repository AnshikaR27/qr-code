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
  const [bounced, setBounced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBounced(true), 450);
    return () => clearTimeout(t);
  }, []);

  if (itemCount === 0) return null;

  const neonShadow = `${tokens.accent}59`;

  return (
    <>
      <style>{`
        @keyframes cartBounce {
          0%   { transform: translateX(-50%) translateY(100%); }
          60%  { transform: translateX(-50%) translateY(-5px); }
          100% { transform: translateX(-50%) translateY(0); }
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
          animation: bounced
            ? 'none'
            : 'cartBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Frost backdrop */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: `linear-gradient(to top, ${tokens.bg} 60%, transparent)`,
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
            borderRadius: 16,
            background: tokens.ctaGradient,
            color: '#fff',
            boxShadow: `0 4px 24px ${neonShadow}`,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {/* Left: count badge + "View Cart" */}
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
