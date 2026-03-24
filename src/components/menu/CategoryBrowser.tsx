'use client';

import { useMemo } from 'react';
import CategoryCard from './CategoryCard';
import { getDarkBrand } from '@/lib/utils';
import type { Category, Product } from '@/types';

interface Props {
  categories: Category[];
  products: Product[];
  primaryColor: string;
  cartItems: { product_id: string; quantity: number }[];
  onSelectCategory: (categoryId: string) => void;
}

export default function CategoryBrowser({
  categories,
  products,
  primaryColor,
  cartItems,
  onSelectCategory,
}: Props) {
  // Filter to categories that have at least one available dish
  const visibleCategories = useMemo(() => {
    return categories.filter((cat) =>
      products.some((p) => p.category_id === cat.id && p.is_available)
    );
  }, [categories, products]);

  // Get first dish image per category
  const coverImages = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const cat of visibleCategories) {
      const first = products.find((p) => p.category_id === cat.id && p.image_url);
      map.set(cat.id, first?.image_url ?? null);
    }
    return map;
  }, [visibleCategories, products]);

  // Count cart items per category
  const cartCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      const product = products.find((p) => p.id === item.product_id);
      if (product?.category_id) {
        map.set(product.category_id, (map.get(product.category_id) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [cartItems, products]);

  return (
    <div style={{ backgroundColor: getDarkBrand(primaryColor), minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Page heading */}
      <div style={{ padding: '28px 16px 16px' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          Food Category You Might Love
        </h1>
      </div>

      {/* 2-column grid */}
      <div
        style={{
          padding: '0 12px 120px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        {visibleCategories.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            coverImageUrl={coverImages.get(cat.id) ?? null}
            primaryColor={primaryColor}
            cartItemCount={cartCountByCategory.get(cat.id) ?? 0}
            onClick={() => onSelectCategory(cat.id)}
            animationDelay={i * 60}
          />
        ))}
      </div>
    </div>
  );
}
