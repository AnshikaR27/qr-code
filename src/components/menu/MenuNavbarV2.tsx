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
      className={`backdrop-blur-md transition-all duration-200 ${isScrolled ? 'py-2 min-[400px]:py-2.5' : 'py-3 min-[400px]:py-4'} px-3 min-[400px]:px-4 flex items-center`}
      style={{
        backgroundColor: isScrolled
          ? 'color-mix(in srgb, var(--sunday-nav-bg, #efebe2) 95%, transparent)'
          : 'var(--sunday-nav-bg, #efebe2)',
        borderBottom: isScrolled ? '1px solid color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)' : 'none',
      }}
    >
      {/* Left: back arrow */}
      <button
        onClick={() => window.history.back()}
        className="w-9 h-9 min-[400px]:w-10 min-[400px]:h-10 flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ color: 'var(--sunday-text, #1c1c17)' }}
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Center: restaurant name */}
      <div className="flex-1 flex flex-col items-center min-w-0">
        <span
          className="font-bold truncate transition-all duration-200 text-base min-[400px]:text-lg"
          style={{ color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
        >
          {restaurant.name}
        </span>
      </div>

      {/* Right: search icon */}
      <button
        key={animKey}
        onClick={onSearch ?? onCartOpen}
        className="w-9 h-9 min-[400px]:w-10 min-[400px]:h-10 flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ color: 'var(--sunday-text, #1c1c17)' }}
        aria-label="Search"
      >
        <Search size={18} strokeWidth={2} color="currentColor" />
      </button>
    </div>
  );
}
