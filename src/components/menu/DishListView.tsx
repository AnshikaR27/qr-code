'use client';

import { useState, useMemo } from 'react';
import MenuHeader from './MenuHeader';
import FilterRow from './FilterRow';
import SectionHeading from './SectionHeading';
import DishCard from './DishCard';
import type { Category, Product, Restaurant } from '@/types';
import type { DietFilter } from '@/lib/constants';

interface Props {
  category: Category;
  allCategories: Category[];
  products: Product[];
  primaryColor: string;
  restaurant: Restaurant;
  dietFilter: DietFilter;
  onDietFilterChange: (f: DietFilter) => void;
  onBack: () => void;
  onCategoryChange: (id: string) => void;
  onTapDish: (product: Product) => void;
  itemCount: number;
  onCartOpen: () => void;
  searchOpen: boolean;
  onSearchToggle: () => void;
  search: string;
  onSearch: (v: string) => void;
}

export default function DishListView({
  category,
  allCategories,
  products,
  primaryColor,
  restaurant,
  dietFilter,
  onDietFilterChange,
  onBack,
  onCategoryChange,
  onTapDish,
  itemCount,
  onCartOpen,
  searchOpen,
  onSearchToggle,
  search,
  onSearch,
}: Props) {
  const [sectionOpen, setSectionOpen] = useState(true);

  // Top 3 by order_count for bestseller badge
  const topDishIds = useMemo(() => {
    const sorted = [...products]
      .filter((d) => d.order_count > 0)
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 3);
    return new Map(sorted.map((d, i) => [d.id, (i + 1) as 1 | 2 | 3]));
  }, [products]);

  const filtered = useMemo(() => {
    let result = products.filter((p) => p.category_id === category.id);
    if (dietFilter === 'veg') result = result.filter((p) => p.is_veg);
    if (dietFilter === 'non_veg') result = result.filter((p) => !p.is_veg);
    if (dietFilter === 'jain') result = result.filter((p) => p.is_jain);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.name_hindi && p.name_hindi.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, category.id, dietFilter, search]);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        minHeight: '100vh',
        paddingBottom: 100,
      }}
    >
      <style>{`
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        * { -webkit-tap-highlight-color: transparent; }
        input[type="search"]::-webkit-search-cancel-button { display: none; }
      `}</style>

      {/* Sticky header */}
      <MenuHeader
        view="list"
        restaurant={restaurant}
        primaryColor={primaryColor}
        itemCount={itemCount}
        onCartOpen={onCartOpen}
        categoryName={category.name}
        onBack={onBack}
        onSearchToggle={onSearchToggle}
      />

      {/* Search bar (toggled) */}
      {searchOpen && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #F0F0F0',
          }}
        >
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search dishes…"
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 10,
              border: '1.5px solid #E0E0E0',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: '#1D1D1D',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Filter row */}
      <FilterRow
        categories={allCategories}
        selectedCategoryId={category.id}
        onCategoryChange={onCategoryChange}
        dietFilter={dietFilter}
        onDietFilterChange={onDietFilterChange}
      />

      {/* Section heading */}
      <SectionHeading
        title={category.name}
        primaryColor={primaryColor}
        isOpen={sectionOpen}
        onToggle={() => setSectionOpen((o) => !o)}
      />

      {/* Dish list */}
      {sectionOpen && (
        <>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '60px 32px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1D1D1D',
                  margin: 0,
                }}
              >
                No dishes found
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: '#999',
                  marginTop: 6,
                }}
              >
                Try adjusting your filter
              </p>
            </div>
          ) : (
            filtered.map((product, i) => (
              <DishCard
                key={product.id}
                product={product}
                rank={topDishIds.get(product.id) ?? null}
                primaryColor={primaryColor}
                onTap={onTapDish}
                animationDelay={i * 50}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
