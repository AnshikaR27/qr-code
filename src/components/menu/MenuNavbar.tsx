'use client';

import { ShoppingBag } from 'lucide-react';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  tokens: MenuTokens;
  itemCount: number;
  onCartOpen: () => void;
}

export default function MenuNavbar({ restaurant, tokens, itemCount, onCartOpen }: Props) {
  return (
    <>
      <style>{`
        @keyframes bagPulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          background: tokens.headerGradient,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Left — empty placeholder for hamburger */}
        <div style={{ width: 42, flexShrink: 0 }} />

        {/* Center — Logo (THE HERO) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: tokens.fontHeading,
                fontSize: 26,
                fontWeight: 800,
                color: tokens.text,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {restaurant.name}
            </div>
            {restaurant.city && (
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 9,
                  fontWeight: 600,
                  color: tokens.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  marginTop: 3,
                }}
              >
                {restaurant.city}
              </div>
            )}
          </div>
        </div>

        {/* Right — Cart bag */}
        <button
          onClick={onCartOpen}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            backgroundColor: tokens.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            animation: itemCount > 0 ? 'bagPulse 0.3s ease' : 'none',
          }}
        >
          <ShoppingBag size={22} color="#fff" />
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: itemCount > 0 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.25)',
              color: itemCount > 0 ? '#fff' : 'rgba(255,255,255,0.6)',
              fontSize: 10,
              fontWeight: 900,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: tokens.fontBody,
              lineHeight: 1,
            }}
          >
            {itemCount}
          </span>
        </button>
      </div>
    </>
  );
}
