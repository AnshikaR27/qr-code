'use client';

import { useState, useEffect, useRef } from 'react';
import type { MenuTokens } from '@/lib/tokens';
import type { DietFilter } from '@/lib/constants';

export type SortBy = 'default' | 'popular' | 'price_asc' | 'price_desc';

interface Props {
  tokens: MenuTokens;
  dietFilter: DietFilter;
  onDietFilterChange: (f: DietFilter) => void;
  sortBy: SortBy;
  onSortByChange: (s: SortBy) => void;
}

export default function FloatingFilters({
  tokens,
  dietFilter,
  onDietFilterChange,
  sortBy,
  onSortByChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 50 || y <= lastScrollY.current) {
        setVisible(true);
      } else {
        setVisible(false);
      }
      lastScrollY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const DIET_OPTIONS: { v: DietFilter; l: string }[] = [
    { v: 'all', l: 'All' },
    { v: 'veg', l: '🥦 Veg' },
    { v: 'non_veg', l: '🍗 Non-Veg' },
    { v: 'jain', l: '🌿 Jain' },
  ];

  const SORT_OPTIONS: { v: SortBy; l: string }[] = [
    { v: 'default', l: 'Default' },
    { v: 'popular', l: '🔥 Popular' },
    { v: 'price_asc', l: '↑ Price' },
    { v: 'price_desc', l: '↓ Price' },
  ];

  return (
    <>
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Floating pill button */}
      <div
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 40,
          padding: '10px 18px',
          borderRadius: 50,
          backgroundColor: tokens.secondary,
          color: '#fff',
          fontFamily: tokens.fontBody,
          fontSize: 13,
          fontWeight: 700,
          // Ambient shadow per DESIGN.md
          boxShadow: `0 8px 32px -8px ${tokens.text}26`,
          cursor: 'pointer',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          pointerEvents: visible ? 'auto' : 'none',
          userSelect: 'none',
        }}
      >
        🔽 Filters
      </div>

      {/* Filter bottom sheet */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: tokens.cardBg,
              borderRadius: '24px 24px 0 0',
              paddingBottom: 40,
              animation: 'sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div
                style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: tokens.border }}
              />
            </div>

            <div style={{ padding: '8px 20px 0' }}>
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: 16,
                  fontWeight: 800,
                  color: tokens.text,
                  marginBottom: 20,
                }}
              >
                Filters
              </div>

              {/* Diet toggles */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 11,
                    fontWeight: 700,
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 10,
                  }}
                >
                  Diet
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DIET_OPTIONS.map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => onDietFilterChange(v)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 50,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: tokens.fontBody,
                        fontSize: 13,
                        fontWeight: 600,
                        background: dietFilter === v ? tokens.ctaGradient : tokens.surfaceLow,
                        color: dietFilter === v ? '#fff' : tokens.textMuted,
                        boxShadow: dietFilter === v ? `0 4px 14px ${tokens.primary}40` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort by */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 11,
                    fontWeight: 700,
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 10,
                  }}
                >
                  Sort By
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SORT_OPTIONS.map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => onSortByChange(v)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 50,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: tokens.fontBody,
                        fontSize: 13,
                        fontWeight: 600,
                        background: sortBy === v ? tokens.ctaGradient : tokens.surfaceLow,
                        color: sortBy === v ? '#fff' : tokens.textMuted,
                        boxShadow: sortBy === v ? `0 4px 14px ${tokens.primary}40` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Done button */}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 24,
                  background: tokens.ctaGradient,
                  color: '#fff',
                  fontFamily: tokens.fontBody,
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
