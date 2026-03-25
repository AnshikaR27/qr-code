'use client';

import { ShoppingBag } from 'lucide-react';
import { alpha } from '@/lib/palette';
import type { BrandPalette } from '@/lib/palette';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  palette: BrandPalette;
  itemCount: number;
  onCartOpen: () => void;
}

export default function MenuNavbar({ restaurant, palette, itemCount, onCartOpen }: Props) {
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
          background: palette.headerGradient,
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
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              style={{ maxHeight: 48, width: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: palette.secondaryText,
                  lineHeight: 1.2,
                }}
              >
                {restaurant.name}
              </div>
              {restaurant.city && (
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 9,
                    fontWeight: 600,
                    color: alpha(palette.secondaryText, 0.5),
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginTop: 2,
                  }}
                >
                  {restaurant.city}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — Cart bag */}
        <button
          onClick={onCartOpen}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            backgroundColor: palette.pop,
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
          <ShoppingBag size={22} color={palette.popText} />
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: itemCount > 0 ? 'rgba(0,0,0,0.7)' : alpha(palette.secondaryText, 0.25),
              color: itemCount > 0 ? '#fff' : alpha(palette.secondaryText, 0.6),
              fontSize: 10,
              fontWeight: 900,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans)',
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
