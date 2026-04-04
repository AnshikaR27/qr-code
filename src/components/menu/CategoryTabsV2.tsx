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
    <div className="bg-white border-b border-gray-100">
      <div className="flex overflow-x-auto scrollbar-hide px-4">
        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = (lang === 'hi' && cat.name_hindi) ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              className={`shrink-0 px-3 py-3 border-b-2 bg-transparent font-body text-[13px] whitespace-nowrap transition-colors duration-150 ${
                active
                  ? 'text-[#1A1A1A] font-bold'
                  : 'border-transparent text-[#999] font-medium'
              }`}
              style={active ? { borderBottomColor: 'var(--sunday-accent)' } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
