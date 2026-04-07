'use client';

import { Utensils } from 'lucide-react';
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
      {/* Hero image */}
      <div className="w-full h-[22vh] min-[400px]:h-[28vh] relative overflow-hidden">
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={restaurant.name}
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
      <div className="flex justify-center -mt-[60px] min-[400px]:-mt-[75px] relative z-10">
        <div className="w-[88px] h-[88px] min-[400px]:w-[110px] min-[400px]:h-[110px] rounded-full shadow-lg flex items-center justify-center overflow-hidden border-4 border-white"
          style={{ backgroundColor: 'var(--sunday-card-bg, #FFFFFF)' }}>
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-[72px] h-[72px] min-[400px]:w-[90px] min-[400px]:h-[90px] rounded-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl font-bold" style={{ color: 'var(--sunday-accent, #b12d00)' }}>
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Restaurant name */}
      <h1 className="font-display text-xl min-[400px]:text-2xl font-bold text-center mt-3 min-[400px]:mt-4" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
        Welcome to {restaurant.name}
      </h1>

      {/* Tagline */}
      {(restaurant.tagline || restaurant.city || restaurant.address) && (
        <p className="font-serif text-[13px] min-[400px]:text-[15px] italic text-center mt-1.5 min-[400px]:mt-2 max-w-[280px] mx-auto leading-relaxed line-clamp-3" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
          {restaurant.tagline
            ?? (restaurant.address
              ? `${restaurant.address}${restaurant.city ? `, ${restaurant.city}` : ''}`
              : `In the heart of ${restaurant.city}`)}
        </p>
      )}

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-2.5 min-[400px]:gap-3 px-3.5 min-[400px]:px-4 mt-6 min-[400px]:mt-8" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
        {categories.map((cat) => {
          const imgUrl = getCategoryImage(cat.id, products);
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="text-left bg-transparent border-none cursor-pointer p-0"
            >
              <div
                className="aspect-[3/2] rounded-xl overflow-hidden mb-2"
                style={{ backgroundColor: 'var(--sunday-surface-low, #f6f2e9)' }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt={cat.name}
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
              <p className="font-body text-sm min-[400px]:text-base font-semibold" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                {cat.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
