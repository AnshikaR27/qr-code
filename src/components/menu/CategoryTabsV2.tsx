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
      style={{ backgroundColor: 'var(--sunday-nav-bg, #efebe2)' }}
    >
      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-4 py-2">
        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              className="shrink-0 px-3.5 min-[400px]:px-4 py-1.5 min-[400px]:py-2 rounded-full text-[13px] min-[400px]:text-[14px] whitespace-nowrap transition-all duration-150 border-none bg-transparent"
              style={{
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
                      opacity: 0.6,
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
