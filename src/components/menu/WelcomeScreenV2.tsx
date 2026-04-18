'use client';

import { Utensils } from 'lucide-react';
import { cdnImg } from '@/lib/utils';
import type { Restaurant, Category, Product } from '@/types';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  onCategorySelect: (categoryId: string) => void;
}

function getCategoryImage(categoryId: string, products: Product[]): string | null {
  const withImage = products.find((p) => p.category_id === categoryId && p.image_url);
  return withImage?.image_url ?? null;
}

function getAvailableCount(categoryId: string, products: Product[]): number {
  return products.filter((p) => p.category_id === categoryId && p.is_available).length;
}

export default function WelcomeScreenV2({
  restaurant,
  categories,
  products,
  onCategorySelect,
}: Props) {
  const heroUrl = restaurant.hero_image_url
    ?? products.find((p) => p.image_url)?.image_url
    ?? null;

  const accent = restaurant.design_tokens?.['--accent'] ?? '#b12d00';
  const primary = restaurant.design_tokens?.['--primary'] ?? '#361f1a';

  return (
    <div
      className="min-h-[100dvh] relative"
      style={{ backgroundColor: 'var(--sunday-bg, #fdf9f0)' }}
    >
      <style>{`
        @keyframes welcome-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hero — full bleed, 58dvh */}
      <div className="w-full relative overflow-hidden" style={{ height: '58dvh' }}>
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnImg(heroUrl)!}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)' }}
          />
        )}
        {/* Gradient fade at the bottom so text overlaps legibly */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 40%, var(--sunday-bg, #fdf9f0) 100%)',
          }}
        />
      </div>

      {/* Identity block — overlaps bottom of hero */}
      <div
        className="relative z-10"
        style={{
          marginTop: '-72px',
          paddingLeft: '20px',
          paddingRight: '20px',
          animation: 'welcome-fade-up 500ms cubic-bezier(0.23, 1, 0.32, 1) both',
        }}
      >
        {(restaurant.city || restaurant.address) && (
          <p
            className="m-0"
            style={{
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accent,
              fontFamily: 'var(--sunday-font-body)',
              marginBottom: '6px',
            }}
          >
            {restaurant.city ?? restaurant.address}
          </p>
        )}
        <h1
          className="m-0 leading-none"
          style={{
            fontSize: 'clamp(32px, 9vw, 48px)',
            fontWeight: 800,
            color: 'var(--sunday-text, #1c1c17)',
            fontFamily: 'var(--sunday-font-heading)',
            letterSpacing: '-0.02em',
          }}
        >
          {restaurant.name}
        </h1>
        {restaurant.tagline && (
          <p
            className="m-0"
            style={{
              fontSize: '13px',
              color: 'var(--sunday-text-muted, #7A6040)',
              fontFamily: 'var(--sunday-font-body)',
              marginTop: '8px',
              lineHeight: 1.5,
              maxWidth: '280px',
            }}
          >
            {restaurant.tagline}
          </p>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--sunday-border, #E8D5B0)',
          margin: '20px 20px 0',
        }}
      />

      {/* Category list — vertical editorial */}
      <div style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
        {categories.map((cat, i) => {
          const imgUrl = getCategoryImage(cat.id, products);
          const count = getAvailableCount(cat.id, products);
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="w-full bg-transparent border-none cursor-pointer text-left"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderBottom:
                  '1px solid color-mix(in srgb, var(--sunday-border, #E8D5B0) 60%, transparent)',
                animation: `welcome-fade-up 420ms cubic-bezier(0.23, 1, 0.32, 1) both`,
                animationDelay: `${80 + i * 55}ms`,
                WebkitTapHighlightColor: 'transparent',
                transition: 'background-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'color-mix(in srgb, var(--sunday-border, #E8D5B0) 25%, transparent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onTouchStart={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'color-mix(in srgb, var(--sunday-border, #E8D5B0) 25%, transparent)';
              }}
              onTouchEnd={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {/* Thumbnail */}
              <div
                className="overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cdnImg(imgUrl)!}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primary}18, ${accent}30)` }}
                  >
                    <Utensils
                      size={18}
                      strokeWidth={1.5}
                      style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
                    />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold"
                  style={{
                    fontSize: '15px',
                    color: 'var(--sunday-text, #1c1c17)',
                    fontFamily: 'var(--sunday-font-body)',
                    lineHeight: 1.3,
                  }}
                >
                  {cat.name}
                </div>
                {count > 0 && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--sunday-text-muted, #7A6040)',
                      fontFamily: 'var(--sunday-font-body)',
                      marginTop: '2px',
                    }}
                  >
                    {count} {count === 1 ? 'item' : 'items'}
                  </div>
                )}
              </div>

              {/* Index numeral */}
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--sunday-text-muted, #7A6040)',
                  fontFamily: 'var(--sunday-font-body)',
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Arrow */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--sunday-text-muted, #7A6040)', flexShrink: 0 }}
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
