'use client';

import { useEffect, useRef } from 'react';
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
    <div
      style={{
        backgroundColor: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1a1a1a',
      }}
    >
      <style>{`
        .cat-tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="cat-tabs-scroll"
        style={{
          display: 'flex',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {allItems.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                padding: '12px 16px 10px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? primaryColor : 'transparent'}`,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 800 : 500,
                color: isActive ? '#fff' : '#555',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                userSelect: 'none',
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
