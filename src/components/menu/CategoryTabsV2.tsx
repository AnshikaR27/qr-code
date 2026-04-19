'use client';

import { useEffect, useRef } from 'react';
import { typeScale, spacingScale } from '@/lib/sunday-scale';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeTab: string;
  onSelect: (id: string) => void;
  lang?: 'en' | 'hi';
}

export default function CategoryTabsV2({
  categories,
  activeTab,
  onSelect,
  lang = 'en',
}: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeTab]);

  return (
    <div style={{ backgroundColor: 'var(--sunday-nav-bg, #efebe2)' }} role="tablist" aria-label="Menu categories">
      <div
        className="flex overflow-x-auto scrollbar-hide [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          gap: spacingScale.gap,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: spacingScale.tabPy,
          paddingBottom: spacingScale.tabPy,
        }}
      >
        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              role="tab"
              aria-selected={active}
              className="shrink-0 rounded-full whitespace-nowrap border-none bg-transparent"
              style={{
                transition: 'background-color 150ms ease-out, color 150ms ease-out',
                fontSize: typeScale.body,
                paddingLeft: spacingScale.tabPx,
                paddingRight: spacingScale.tabPx,
                paddingTop: spacingScale.tabPy,
                paddingBottom: spacingScale.tabPy,
                fontFamily: 'var(--sunday-font-body)',
                ...(active
                  ? {
                      backgroundColor: 'var(--sunday-primary, #361f1a)',
                      color: 'var(--sunday-primary-text, #fff)',
                      fontWeight: 700,
                    }
                  : {
                      color: 'var(--sunday-text-muted, #7A6040)',
                      fontWeight: 500,
                    }),
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
