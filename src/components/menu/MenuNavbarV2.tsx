'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  tokens: MenuTokens;
  itemCount: number;
  onCartOpen: () => void;
  lang?: 'en' | 'hi';
  onLangToggle?: () => void;
  isScrolled?: boolean;
  onSearch?: () => void;
  currentCategory?: string;
}

export default function MenuNavbarV2({
  restaurant,
  itemCount,
  onCartOpen,
  isScrolled = false,
  onSearch,
  currentCategory,
}: Props) {
  const prevCountRef = useRef(itemCount);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setAnimKey((k) => k + 1);
      navigator.vibrate?.(60);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  return (
    <div
      className={`backdrop-blur-md transition-all duration-200 ${isScrolled ? 'py-2.5' : 'py-4'} px-4 flex items-center`}
      style={{
        backgroundColor: isScrolled
          ? 'color-mix(in srgb, var(--sunday-nav-bg, #efebe2) 95%, transparent)'
          : 'var(--sunday-nav-bg, #efebe2)',
        borderBottom: isScrolled ? '1px solid var(--sunday-border, #E8D5B0)' : 'none',
      }}
    >
      {/* Left: back arrow */}
      <button
        onClick={() => window.history.back()}
        className="w-10 h-10 flex items-center justify-center shrink-0"
        style={{ color: 'var(--sunday-text, #1c1c17)' }}
        aria-label="Go back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Center: restaurant name */}
      <div className="flex-1 flex flex-col items-center min-w-0">
        <span
          className="font-display font-bold truncate transition-all duration-200 text-lg"
          style={{ color: 'var(--sunday-text, #1c1c17)' }}
        >
          {restaurant.name}
        </span>
      </div>

      {/* Right: search icon */}
      <button
        key={animKey}
        onClick={onSearch ?? onCartOpen}
        className="w-10 h-10 flex items-center justify-center shrink-0"
        style={{ color: 'var(--sunday-text, #1c1c17)' }}
        aria-label="Search"
      >
        <Search size={20} strokeWidth={2} color="currentColor" />
      </button>
    </div>
  );
}
