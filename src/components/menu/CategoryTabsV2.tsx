'use client';

import { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // Update the sliding indicator position whenever activeTab changes
  useEffect(() => {
    const btn = buttonRefs.current.get(activeTab);
    const container = containerRef.current;
    if (!btn || !container) return;

    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      left: btn.offsetLeft,
      width: btnRect.width,
    });

    // Scroll active tab into view
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab, categories]);

  return (
    <div
      style={{ backgroundColor: 'var(--sunday-nav-bg, #efebe2)' }}
      role="tablist"
      aria-label="Menu categories"
    >
      <div
        ref={containerRef}
        className="relative flex overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '10px',
          paddingBottom: '0px',
          gap: '0',
        }}
      >
        {/* Sliding dot indicator — separate element, translates instead of re-painting */}
        {indicator && (
          <div
            className="absolute bottom-0 h-[3px] rounded-full"
            style={{
              left: `${indicator.left}px`,
              width: `${indicator.width}px`,
              backgroundColor: 'var(--sunday-accent, #b12d00)',
              transition: 'left 220ms cubic-bezier(0.23, 1, 0.32, 1), width 220ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          />
        )}

        {categories.map((cat) => {
          const active = cat.id === activeTab;
          const label = lang === 'hi' && cat.name_hindi ? cat.name_hindi : cat.name;
          return (
            <button
              key={cat.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(cat.id, el);
                else buttonRefs.current.delete(cat.id);
              }}
              onClick={() => onSelect(cat.id)}
              role="tab"
              aria-selected={active}
              className="shrink-0 whitespace-nowrap border-none bg-transparent cursor-pointer"
              style={{
                fontSize: '13px',
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingBottom: '10px',
                fontFamily: 'var(--sunday-font-body)',
                fontWeight: active ? 700 : 400,
                color: active
                  ? 'var(--sunday-text, #1c1c17)'
                  : 'var(--sunday-text-muted, #7A6040)',
                opacity: active ? 1 : 0.6,
                transition: 'color 150ms ease, opacity 150ms ease, font-weight 150ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Bottom hairline */}
      <div
        style={{
          height: '1px',
          backgroundColor:
            'color-mix(in srgb, var(--sunday-border, #E8D5B0) 60%, transparent)',
        }}
      />
    </div>
  );
}
