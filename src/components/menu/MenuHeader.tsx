'use client';

import Image from 'next/image';
import { getNavbarBrand } from '@/lib/utils';
import type { Restaurant } from '@/types';

interface Props {
  view: 'browser' | 'list';
  restaurant: Restaurant;
  primaryColor: string;
  // View 2 specific
  categoryName?: string;
  onBack?: () => void;
  onSearchToggle?: () => void;
}

export default function MenuHeader({
  view,
  restaurant,
  primaryColor,
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

  // View 1 — brand-adaptive navbar, visually distinct from page
  const hasLogo = Boolean(restaurant.logo_url);
  const tagline = restaurant.city ?? '';

  return (
    <div
      style={{
        backgroundColor: getNavbarBrand(primaryColor),
        padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {hasLogo ? (
        /* Mode A — logo image */
        <>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}
          >
            <Image
              src={restaurant.logo_url!}
              alt={restaurant.name}
              width={40}
              height={40}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.2,
              }}
            >
              {restaurant.name}
            </p>
            {tagline && (
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                {tagline}
              </p>
            )}
          </div>
        </>
      ) : (
        /* Mode B — text-only logo (no circle, no placeholder) */
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.2,
            }}
          >
            {restaurant.name}
          </p>
          {tagline && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {tagline}
            </p>
          )}
        </div>
      )}
      {/* RIGHT SIDE — Nothing. Cart is only the floating button at bottom-right. */}
    </div>
  );
}
