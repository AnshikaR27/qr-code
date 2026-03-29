'use client';

import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeTab: string;
  tokens: MenuTokens;
  onSelect: (id: string) => void;
}

export default function CategoryTabs({ categories, activeTab, tokens, onSelect }: Props) {
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
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
