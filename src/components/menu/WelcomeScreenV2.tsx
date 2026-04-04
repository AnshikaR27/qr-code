'use client';

import { Utensils } from 'lucide-react';
import type { Restaurant, Category, Product } from '@/types';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  onCategorySelect: (categoryId: string) => void;
}

/** Get a representative image for a category from its products */
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
  // Hero: use hero_image_url if set, otherwise first product image, otherwise gradient
  const heroUrl = restaurant.hero_image_url
    ?? products.find((p) => p.image_url)?.image_url
    ?? null;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero image */}
      <div className="w-full h-[40vh] relative overflow-hidden">
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
              background: `linear-gradient(135deg, ${restaurant.design_tokens?.['--primary'] ?? '#D4A373'}22, ${restaurant.design_tokens?.['--accent'] ?? '#FEFAE0'}44)`,
            }}
          />
        )}
      </div>

      {/* Logo circle overlapping hero — 110px */}
      <div className="flex justify-center -mt-[55px] relative z-10">
        <div className="w-[110px] h-[110px] rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden border-4 border-white">
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-[90px] h-[90px] rounded-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl font-bold" style={{ color: 'var(--sunday-accent)' }}>
              {restaurant.name.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Restaurant name */}
      <h1 className="font-display text-2xl font-bold text-[#1A1A1A] text-center mt-4">
        {restaurant.name}
      </h1>

      {/* Tagline */}
      {(restaurant.city || restaurant.address) && (
        <p className="font-body text-sm text-[#666] text-center mt-2 max-w-[280px] mx-auto leading-relaxed line-clamp-2">
          {restaurant.address
            ? `${restaurant.address}${restaurant.city ? `, ${restaurant.city}` : ''}`
            : `In the heart of ${restaurant.city}`}
        </p>
      )}

      {/* Category grid — aspect 4:3 */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-8 pb-28">
        {categories.map((cat) => {
          const imgUrl = getCategoryImage(cat.id, products);
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="text-left bg-transparent border-none cursor-pointer p-0"
            >
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F5F0] mb-2">
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
                    style={{
                      background: `linear-gradient(135deg, ${restaurant.design_tokens?.['--primary'] ?? '#D4A373'}18, ${restaurant.design_tokens?.['--accent'] ?? '#FEFAE0'}30)`,
                    }}
                  >
                    <span className="font-body text-lg font-semibold text-[#999] text-center px-3">
                      {cat.name}
                    </span>
                  </div>
                )}
              </div>
              <p className="font-body text-base font-semibold text-[#1A1A1A]">
                {cat.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
