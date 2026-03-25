'use client';

import type { BrandPalette } from '@/lib/palette';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeTab: string;
  palette: BrandPalette;
  onSelect: (id: string) => void;
}

export default function CategoryTabs({ categories, activeTab, palette, onSelect }: Props) {
  return (
    <div
      style={{
        backgroundColor: palette.pageBg,
        borderBottom: `1.5px solid ${palette.light}`,
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
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              color: active ? palette.dark : palette.midLight,
              borderBottom: active ? `3px solid ${palette.base}` : '3px solid transparent',
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
