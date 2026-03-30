'use client';

import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeTab: string;
  tokens: MenuTokens;
  onSelect: (id: string) => void;
  productCounts?: Record<string, number>;
  lang?: 'en' | 'hi';
}

export default function CategoryTabs({ categories, activeTab, tokens, onSelect, productCounts, lang = 'en' }: Props) {
  return (
    <div
      style={{
        backgroundColor: tokens.navBg,
        display: 'flex',
        overflowX: 'auto',
        padding: '0 16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as React.CSSProperties}
    >
      <style>{`
        .category-tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      {categories.map((cat) => {
        const active = cat.id === activeTab;
        const count = productCounts?.[cat.id];
        const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="cat-tab-btn"
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              margin: '6px 4px 6px 0',
              border: 'none',
              borderRadius: 9999,
              background: active ? tokens.primary : tokens.cardBg,
              cursor: 'pointer',
              fontFamily: tokens.fontBody,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? '#fff' : tokens.textMuted,
              whiteSpace: 'nowrap',
              transition: 'background 0.18s ease, color 0.18s ease',
            }}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: 10,
                  fontWeight: active ? 700 : 600,
                  opacity: active ? 0.85 : 0.65,
                }}
              >
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
