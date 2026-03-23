'use client';

import Image from 'next/image';
import { getContrastText } from '@/lib/utils';
import type { Restaurant } from '@/types';

interface Props {
  view: 'browser' | 'list';
  restaurant: Restaurant;
  primaryColor: string;
  itemCount: number;
  onCartOpen: () => void;
  // View 2 specific
  categoryName?: string;
  onBack?: () => void;
  onSearchToggle?: () => void;
}

export default function MenuHeader({
  view,
  restaurant,
  primaryColor,
  itemCount,
  onCartOpen,
  categoryName,
  onBack,
  onSearchToggle,
}: Props) {
  if (view === 'list') {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '14px 16px',
          borderBottom: '1px solid #F0F0F0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Back arrow */}
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: 20,
            color: '#1D1D1D',
          }}
          aria-label="Back"
        >
          ←
        </button>

        {/* Category name */}
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 700,
            color: '#1D1D1D',
          }}
        >
          {categoryName}
        </span>

        {/* Search icon */}
        <button
          onClick={onSearchToggle}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#F5F5F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: 16,
          }}
          aria-label="Search"
        >
          🔍
        </button>
      </div>
    );
  }

  // View 1 — browser header
  const badgeText = getContrastText(primaryColor);

  return (
    <div
      style={{
        backgroundColor: '#000000',
        padding: '18px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Left: logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {restaurant.logo_url && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              width={40}
              height={40}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        )}
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.2,
            }}
          >
            {restaurant.name}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: 500,
              color: '#999',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            Happiness Brewed
          </p>
        </div>
      </div>

      {/* Right: cart icon */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={onCartOpen}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: '1.5px solid #FFFFFF',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Cart"
        >
          {/* Shopping bag icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </button>
        {itemCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              color: badgeText,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {itemCount}
          </div>
        )}
      </div>
    </div>
  );
}
