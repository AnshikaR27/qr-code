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
    <div
      className="border-b"
      style={{ backgroundColor: 'var(--sunday-nav-bg, #efebe2)', borderColor: 'var(--sunday-border, #E8D5B0)' }}
    >
      <div className="flex overflow-x-auto scrollbar-hide px-4">
        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              className="shrink-0 px-2.5 min-[400px]:px-3 py-2.5 min-[400px]:py-3 border-b-2 bg-transparent font-body text-[12px] min-[400px]:text-[13px] whitespace-nowrap transition-colors duration-150"
              style={active
                ? {
                    borderBottomColor: 'var(--sunday-accent, #b12d00)',
                    color: 'var(--sunday-text, #1c1c17)',
                    fontWeight: 700,
                  }
                : {
                    borderBottomColor: 'transparent',
                    color: 'var(--sunday-text-muted, #7A6040)',
                    fontWeight: 500,
                  }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
