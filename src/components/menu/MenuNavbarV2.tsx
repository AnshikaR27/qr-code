'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function MenuNavbarV2({
  restaurant,
  tokens,
  itemCount,
  onCartOpen,
  lang = 'en',
  onLangToggle,
  isScrolled = false,
}: Props) {
  const prevCountRef = useRef(itemCount);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setAnimKey((k) => k + 1);
      navigator.vibrate?.(60);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const { open, label: hoursLabel } = getHoursStatus(
    restaurant.opening_time,
    restaurant.closing_time
  );

  return (
    <>
      <style>{`
        @keyframes bagPulseV2 {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          backgroundColor: `${tokens.navBg}ee`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: isScrolled ? '10px 16px' : '16px 16px',
          display: 'flex',
          alignItems: 'center',
          transition: 'padding 0.2s ease',
          borderBottom: isScrolled ? `1px solid ${tokens.border}` : 'none',
        }}
      >
        {/* Left: language toggle */}
        <div style={{ width: 42, flexShrink: 0 }}>
          {onLangToggle && (
            <button
              onClick={onLangToggle}
              style={{
                padding: '4px 7px',
                borderRadius: 6,
                border: `1px solid ${tokens.border}`,
                backgroundColor: 'transparent',
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

        {/* Center: restaurant name + status */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: isScrolled ? 16 : 20,
              fontWeight: 700,
              color: tokens.text,
              lineHeight: 1.1,
              transition: 'font-size 0.2s ease',
            }}
          >
            {restaurant.name}
          </div>
          {!isScrolled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              {restaurant.city && (
                <span
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 10,
                    fontWeight: 500,
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                  }}
                >
                  {restaurant.city}
                </span>
              )}
              {restaurant.city && (
                <span style={{ color: tokens.border, fontSize: 9 }}>·</span>
              )}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: tokens.fontBody,
                  fontSize: 10,
                  fontWeight: 600,
                  color: open ? tokens.success : tokens.error,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: open ? tokens.success : tokens.error,
                    flexShrink: 0,
                  }}
                />
                {hoursLabel}
              </span>
            </div>
          )}
        </div>

        {/* Right: cart count button */}
        <button
          key={animKey}
          onClick={onCartOpen}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            backgroundColor: tokens.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            animation: 'bagPulseV2 0.3s ease',
          }}
        >
          {/* Shopping bag icon (inline SVG for cleanliness) */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.cardBg}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {itemCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                backgroundColor: tokens.primary,
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                width: 17,
                height: 17,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: tokens.fontBody,
                lineHeight: 1,
                border: `2px solid ${tokens.navBg}`,
              }}
            >
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
