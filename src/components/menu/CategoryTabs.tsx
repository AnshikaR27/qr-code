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
    <div className="relative bg-white/90 backdrop-blur-md border-b border-gray-100">
      {/* Left fade */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10"
        style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.95), transparent)' }} />
      {/* Right fade */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
        style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.95), transparent)' }} />

      <div
        className="flex gap-2.5 overflow-x-auto scrollbar-hide px-5 py-3.5"
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
                'flex-shrink-0 flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold',
                'transition-all duration-250 whitespace-nowrap select-none',
                'active:scale-95',
                isActive
                  ? 'text-white shadow-lg scale-[1.04]'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              style={
                isActive
                  ? {
                      backgroundColor: primaryColor,
                      boxShadow: `0 4px 14px ${primaryColor}55`,
                    }
                  : {
                      backgroundColor: `${primaryColor}12`,
                    }
              }
            >
              {cat.name}
              {cat.name_hindi && (
                <span className="text-[10px] opacity-70 font-medium">{cat.name_hindi}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
