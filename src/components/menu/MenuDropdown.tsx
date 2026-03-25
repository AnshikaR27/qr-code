'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BrandPalette } from '@/lib/palette';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeCategoryId: string;
  palette: BrandPalette;
  onSelect: (id: string) => void;
}

export default function MenuDropdown({ categories, activeCategoryId, palette, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <>
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Trigger row */}
      <div
        onClick={() => setOpen(true)}
        style={{
          padding: '12px 16px',
          backgroundColor: palette.pageBg,
          borderBottom: `1.5px solid ${palette.light}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 900,
            color: palette.dark,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          MENU
        </span>
        <ChevronRight size={14} color={palette.midLight} />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 900,
            color: palette.dark,
            textTransform: 'uppercase',
          }}
        >
          {activeCategory?.name ?? ''}
        </span>
      </div>

      {/* Bottom sheet overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
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
              backgroundColor: palette.cardBg,
              borderRadius: '24px 24px 0 0',
              paddingBottom: 32,
              animation: 'sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div
                style={{
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: palette.light,
                }}
              />
            </div>

            {/* Category list */}
            <div style={{ padding: '8px 0' }}>
              {categories.map((cat) => {
                const isActive = cat.id === activeCategoryId;
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    style={{
                      padding: '14px 20px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 15,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? palette.primary : palette.midDark,
                      borderLeft: isActive
                        ? `3px solid ${palette.base}`
                        : '3px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {cat.name}
                    {cat.name_hindi && (
                      <span
                        style={{
                          fontSize: 12,
                          color: palette.midLight,
                          fontWeight: 400,
                        }}
                      >
                        {cat.name_hindi}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
