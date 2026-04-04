'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
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
    <div className={`bg-white/95 backdrop-blur-md transition-all duration-200 ${isScrolled ? 'py-2.5 border-b border-gray-100' : 'py-4'} px-4 flex items-center`}>
      {/* Left: back arrow */}
      <button
        onClick={() => window.history.back()}
        className="w-10 h-10 flex items-center justify-center shrink-0"
        aria-label="Go back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Center: category name or restaurant name */}
      <div className="flex-1 flex flex-col items-center min-w-0">
        {currentCategory ? (
          <button className="flex items-center gap-1 font-body text-base font-semibold text-[#1A1A1A]">
            <span className="truncate">{currentCategory}</span>
            <ChevronDown size={16} strokeWidth={2} />
          </button>
        ) : (
          <span className={`font-display font-bold text-[#1A1A1A] transition-all duration-200 ${isScrolled ? 'text-lg' : 'text-2xl'}`}>
            {restaurant.name}
          </span>
        )}
      </div>

      {/* Right: search/filter icon */}
      <button
        onClick={onSearch ?? onCartOpen}
        className="w-10 h-10 flex items-center justify-center shrink-0"
        aria-label="Search"
      >
        <Search size={20} strokeWidth={2} color="#1A1A1A" />
      </button>
    </div>
  );
}
