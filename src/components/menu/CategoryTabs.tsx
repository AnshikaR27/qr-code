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
        backgroundColor: tokens.bg,
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
            style={{
              flexShrink: 0,
              padding: '12px 0',
              marginRight: 24,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: tokens.fontBody,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              color: active ? tokens.text : tokens.textMuted,
              borderBottom: active ? `3px solid ${tokens.accent}` : '3px solid transparent',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
