'use client';

import { Utensils } from 'lucide-react';
import { cdnImg } from '@/lib/utils';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
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

export default function WelcomeScreenV2({
  restaurant,
  categories,
  products,
  onCategorySelect,
}: Props) {
  const heroUrl = restaurant.hero_image_url
    ?? products.find((p) => p.image_url)?.image_url
    ?? null;

  const primary = restaurant.design_tokens?.['--primary'] ?? '#361f1a';
  const accent = restaurant.design_tokens?.['--accent'] ?? '#b12d00';

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: 'var(--sunday-bg, #fdf9f0)' }}>
      {/* Hero image — fluid height, no breakpoint needed */}
      <div className="w-full relative overflow-hidden" style={{ height: '25dvh' }}>
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnImg(heroUrl, 960, 360)}
            alt={restaurant.name}
            width={960}
            height={360}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${primary}22, ${accent}44)`,
            }}
          />
        )}
      </div>

      {/* Logo circle overlapping hero */}
      <div
        className="flex justify-center relative z-10"
        style={{ marginTop: sizeScale.logoOverlap }}
      >
        <div
          className="rounded-full flex items-center justify-center overflow-hidden border-4 border-white"
          style={{
            width: sizeScale.logoCircle,
            height: sizeScale.logoCircle,
            backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
            boxShadow: 'var(--sunday-shadow-lg)',
          }}
        >
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cdnImg(restaurant.logo_url, 180)}
              alt={restaurant.name}
              width={180}
              height={180}
              className="rounded-full object-cover"
              style={{ width: sizeScale.logoImg, height: sizeScale.logoImg }}
            />
          ) : (
            <span
              className="text-3xl font-bold"
              style={{ color: 'var(--sunday-accent, #b12d00)', fontFamily: 'var(--sunday-font-heading)' }}
            >
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Restaurant name */}
      <h1
        className="font-bold text-center mt-3"
        style={{ fontSize: typeScale['3xl'], color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
      >
        Welcome to {restaurant.name}
      </h1>

      {/* Tagline */}
      {(restaurant.tagline || restaurant.city || restaurant.address) && (
        <p
          className="italic text-center mt-1.5 max-w-[280px] mx-auto leading-relaxed line-clamp-3"
          style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
        >
          {restaurant.tagline
            ?? (restaurant.address
              ? `${restaurant.address}${restaurant.city ? `, ${restaurant.city}` : ''}`
              : `In the heart of ${restaurant.city}`)}
        </p>
      )}

      {/* Category grid */}
      <div
        className="grid grid-cols-2 mt-6"
        style={{
          gap: spacingScale.gap,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {categories.map((cat) => {
          const imgUrl = getCategoryImage(cat.id, products);
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="text-left bg-transparent border-none cursor-pointer p-0 transition-transform duration-150 active:scale-[0.97]"
            >
              <div
                className="aspect-[3/2] overflow-hidden mb-2"
                style={{
                  borderRadius: 'var(--sunday-radius, 12px)',
                  backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
                  boxShadow: 'var(--sunday-shadow-sm)',
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cdnImg(imgUrl, 400, 267)}
                    alt={cat.name}
                    width={400}
                    height={267}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primary}18, ${accent}30)` }}
                  >
                    <Utensils size={28} strokeWidth={1.5} style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
                  </div>
                )}
              </div>
              <p
                className="font-semibold"
                style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
              >
                {cat.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
