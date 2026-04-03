'use client';

import { useEffect, useRef } from 'react';
import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeTab: string;
  tokens: MenuTokens;
  onSelect: (id: string) => void;
  lang?: 'en' | 'hi';
}

export default function CategoryTabsV2({
  categories,
  activeTab,
  tokens,
  onSelect,
  lang = 'en',
}: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep active tab scrolled into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeTab]);

  return (
    <div
      style={{
        backgroundColor: tokens.navBg,
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        borderBottom: `1px solid ${tokens.border}`,
      } as React.CSSProperties}
    >
      <style>{`.cat-tabs-v2::-webkit-scrollbar { display: none; }`}</style>
      <div className="cat-tabs-v2" style={{ display: 'flex', overflowX: 'auto', padding: '0 12px', scrollbarWidth: 'none', width: '100%' }}>
        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                padding: '12px 12px 10px',
                border: 'none',
                borderBottom: active
                  ? `2px solid ${tokens.text}`
                  : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: tokens.fontBody,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? tokens.text : tokens.textMuted,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
