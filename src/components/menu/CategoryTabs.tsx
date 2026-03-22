'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  primaryColor: string;
}

export default function CategoryTabs({ categories, activeId, onSelect, primaryColor }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId]);

  if (categories.length === 0) return null;

  const allItems = [{ id: 'all', name: 'All', name_hindi: null }, ...categories];

  return (
    <div className="bg-white border-b border-gray-200">
      <div
        className="flex overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {allItems.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              className={cn(
                'flex-shrink-0 relative px-5 py-3.5 text-sm font-bold whitespace-nowrap',
                'transition-colors duration-150 select-none',
                isActive ? 'text-gray-900' : 'text-gray-500',
              )}
            >
              {cat.name}
              {/* Active underline */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
