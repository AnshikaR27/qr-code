'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import MenuHeader from '@/components/menu/MenuHeader';
import CategoryTabs from '@/components/menu/CategoryTabs';
import FilterBar from '@/components/menu/FilterBar';
import DishCard from '@/components/menu/DishCard';
import CartSheet from '@/components/menu/CartSheet';
import DishDetailSheet from '@/components/menu/DishDetailSheet';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import type { Category, Product, Restaurant } from '@/types';
import type { DietFilter } from '@/lib/constants';

function hexToRgb(hex: string) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

export default function CustomerMenu({ restaurant, categories, products, tableId }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const prevCountRef = useRef(0);
  const [cartVisible, setCartVisible] = useState(false);

  const { items, getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();
  const total = getTotal();
  const rawColor = restaurant.primary_color || '#333';
  const p = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
  const { r, g, b } = hexToRgb(p);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (itemCount > 0 && prev === 0) setCartVisible(true);
    else if (itemCount === 0) setCartVisible(false);
    prevCountRef.current = itemCount;
  }, [itemCount]);

  // Top 3 dishes by order_count for "Most liked" badges
  const topDishIds = useMemo(() => {
    const sorted = [...products]
      .filter((d) => d.order_count > 0)
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 3);
    return new Map(sorted.map((d, i) => [d.id, (i + 1) as 1 | 2 | 3]));
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') result = result.filter((d) => d.category_id === activeCategory);
    if (dietFilter === 'veg') result = result.filter((d) => d.is_veg);
    if (dietFilter === 'non_veg') result = result.filter((d) => !d.is_veg);
    if (dietFilter === 'jain') result = result.filter((d) => d.is_jain);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.name_hindi && d.name_hindi.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeCategory, dietFilter, search]);

  const grouped = useMemo(() => {
    if (activeCategory !== 'all') {
      return [{ category: null as Category | null, items: filtered }];
    }
    const groups: { category: Category | null; items: Product[] }[] = [];
    categories.forEach((cat) => {
      const catItems = filtered.filter((d) => d.category_id === cat.id);
      if (catItems.length) groups.push({ category: cat, items: catItems });
    });
    const uncategorised = filtered.filter((d) => !d.category_id);
    if (uncategorised.length) groups.push({ category: null, items: uncategorised });
    return groups;
  }, [filtered, categories, activeCategory]);

  return (
    <div
      style={{
        backgroundColor: '#000',
        minHeight: '100vh',
        maxWidth: 420,
        margin: '0 auto',
        paddingBottom: 120,
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cartPop {
          0%   { transform: translateY(100%); }
          60%  { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
        * { -webkit-tap-highlight-color: transparent; }
        input[type="search"]::-webkit-search-cancel-button { display: none; }
        input::placeholder { color: #444; }
      `}</style>

      {/* Header */}
      <MenuHeader restaurant={restaurant} />

      {/* Sticky controls */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={setActiveCategory}
          primaryColor={p}
        />
        <div style={{ backgroundColor: '#000', paddingTop: 10 }}>
          <FilterBar
            active={dietFilter}
            onChange={setDietFilter}
            search={search}
            onSearch={setSearch}
            primaryColor={p}
          />
        </div>
      </div>

      {/* Dish sections */}
      <div style={{ padding: '0 14px', marginTop: 8 }}>
        {grouped.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 32px',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 48 }}>🔍</div>
            <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>No results found</p>
            <p style={{ color: '#555', fontSize: 13, textAlign: 'center', margin: 0 }}>
              Try adjusting your search or filter
            </p>
          </div>
        )}

        {grouped.map(({ category, items: groupItems }, gi) => (
          <div key={category?.id ?? `g-${gi}`} style={{ marginBottom: 32 }}>
            {/* Category heading */}
            {activeCategory === 'all' && (
              <div style={{ marginBottom: 14 }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {category?.name ?? 'Other'}
                </h2>
                {category?.name_hindi && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555', fontWeight: 500 }}>
                    {category.name_hindi}
                  </p>
                )}
              </div>
            )}

            {/* 2-column grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              {groupItems.map((product, pi) => (
                <div
                  key={product.id}
                  style={{
                    animation: 'fadeIn 0.3s ease forwards',
                    animationDelay: `${pi * 50}ms`,
                    opacity: 0,
                  }}
                >
                  <DishCard
                    product={product}
                    rank={topDishIds.get(product.id) ?? null}
                    primaryColor={p}
                    onTap={setSelectedDish}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 420,
          zIndex: 30,
          padding: '6px 14px 16px',
          pointerEvents: cartVisible ? 'auto' : 'none',
        }}
      >
        {/* Frost gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: p,
            color: '#fff',
            fontWeight: 700,
            boxShadow: `0 4px 24px rgba(${r},${g},${b},0.5), 0 0 0 1px rgba(${r},${g},${b},0.3)`,
            transform: cartVisible ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {itemCount}
            </span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>View Cart</span>
          </div>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{formatPrice(total)}</span>
        </button>
      </div>

      {/* Dish detail bottom sheet */}
      <DishDetailSheet
        product={selectedDish}
        rank={selectedDish ? (topDishIds.get(selectedDish.id) ?? null) : null}
        primaryColor={p}
        onClose={() => setSelectedDish(null)}
      />

      {/* Cart sheet */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        tableId={tableId}
      />
    </div>
  );
}
