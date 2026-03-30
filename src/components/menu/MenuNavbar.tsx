'use client';

import { ShoppingBag } from 'lucide-react';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant } from '@/types';

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}${m > 0 ? ':' + m.toString().padStart(2, '0') : ''} ${ampm}`;
}

function getHoursStatus(opening: string, closing: string): { open: boolean; label: string } {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  const openMin = parseMinutes(opening);
  const closeMin = parseMinutes(closing);
  let open: boolean;
  if (closeMin > openMin) {
    open = total >= openMin && total < closeMin;
  } else {
    open = total >= openMin || total < closeMin;
  }
  const label = open
    ? `Open · Closes ${formatTime12(closing)}`
    : `Closed · Opens ${formatTime12(opening)}`;
  return { open, label };
}

interface Props {
  restaurant: Restaurant;
  tokens: MenuTokens;
  itemCount: number;
  onCartOpen: () => void;
  lang?: 'en' | 'hi';
  onLangToggle?: () => void;
  isScrolled?: boolean;
}

export default function MenuNavbar({
  restaurant,
  tokens,
  itemCount,
  onCartOpen,
  lang = 'en',
  onLangToggle,
  isScrolled = false,
}: Props) {
  const { open, label: hoursLabel } = getHoursStatus(
    restaurant.opening_time,
    restaurant.closing_time
  );

  const hasHindi = !!restaurant.name; // always true, but guards against undefined

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
          backgroundColor: `${tokens.navBg}cc`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: isScrolled ? '8px 16px' : '14px 16px',
          display: 'flex',
          alignItems: 'center',
          transition: 'padding 0.25s ease',
        }}
      >
        {/* Left — Language toggle */}
        <div style={{ width: 42, flexShrink: 0 }}>
          {onLangToggle && hasHindi && (
            <button
              onClick={onLangToggle}
              style={{
                padding: '4px 7px',
                borderRadius: 6,
                border: `1px solid ${tokens.border}`,
                backgroundColor: tokens.cardBg,
                color: tokens.textMuted,
                fontFamily: tokens.fontBody,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>
          )}
        </div>

        {/* Center — Logo */}
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
                fontSize: isScrolled ? 18 : 26,
                fontWeight: 800,
                color: tokens.text,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                transition: 'font-size 0.25s ease',
              }}
            >
              {restaurant.name}
            </div>

            {!isScrolled && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 3 }}>
                {restaurant.city && (
                  <span
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: 9,
                      fontWeight: 600,
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                    }}
                  >
                    {restaurant.city}
                  </span>
                )}
                {restaurant.city && <span style={{ color: tokens.border, fontSize: 8 }}>·</span>}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontFamily: tokens.fontBody,
                    fontSize: 9,
                    fontWeight: 700,
                    color: open ? tokens.success : tokens.error,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: open ? tokens.success : tokens.error, flexShrink: 0 }} />
                  {hoursLabel}
                </span>
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
