'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
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
      className="backdrop-blur-md transition-all duration-200 flex items-center"
      style={{
        paddingTop: isScrolled ? spacingScale.navPyS : spacingScale.navPy,
        paddingBottom: isScrolled ? spacingScale.navPyS : spacingScale.navPy,
        paddingLeft: spacingScale.px,
        paddingRight: spacingScale.px,
        backgroundColor: isScrolled
          ? 'color-mix(in srgb, var(--sunday-nav-bg, #efebe2) 95%, transparent)'
          : 'var(--sunday-surface-low, color-mix(in srgb, var(--sunday-primary) 3%, var(--sunday-nav-bg, #efebe2)))',
        boxShadow: isScrolled ? 'var(--sunday-shadow-sm)' : 'none',
      }}
    >
      {/* Left: back arrow */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{
          width: sizeScale.touchTarget,
          height: sizeScale.touchTarget,
          color: 'var(--sunday-text, #1c1c17)',
        }}
        aria-label="Go back"
      >
        <svg style={{ width: 'clamp(20px, 5.5vw, 24px)', height: 'clamp(20px, 5.5vw, 24px)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Center: restaurant logo — transparent, no box */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {restaurant.logo_url ? (
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            className="w-auto object-contain"
            style={{ height: 'clamp(36px, 10vw, 48px)' }}
          />
        ) : (
          <span
            className="font-bold truncate transition-all duration-200"
            style={{ fontSize: typeScale.base, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
          >
            {restaurant.name}
          </span>
        )}
      </div>

      {/* Right: search icon */}
      <button
        key={animKey}
        onClick={onSearch ?? onCartOpen}
        className="flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{
          width: sizeScale.touchTarget,
          height: sizeScale.touchTarget,
          color: 'var(--sunday-text, #1c1c17)',
        }}
        aria-label="Search"
      >
        <Search style={{ width: 'clamp(20px, 5.5vw, 24px)', height: 'clamp(20px, 5.5vw, 24px)' }} strokeWidth={2} color="currentColor" />
      </button>
    </div>
  );
}
