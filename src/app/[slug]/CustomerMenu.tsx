'use client';

import { useState, useMemo } from 'react';
import MenuHeader from '@/components/menu/MenuHeader';
import CategoryBrowser from '@/components/menu/CategoryBrowser';
import DishListView from '@/components/menu/DishListView';
import DishDetailSheet from '@/components/menu/DishDetailSheet';
import CartBar from '@/components/menu/CartBar';
import CartSheet from '@/components/menu/CartSheet';
import { useCart } from '@/hooks/useCart';
import type { Category, Product, Restaurant } from '@/types';
import type { DietFilter } from '@/lib/constants';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

export default function CustomerMenu({ restaurant, categories, products, tableId }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const { items, getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();
  const total = getTotal();

  const rawColor = restaurant.primary_color || '#333';
  const primaryColor = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategory) ?? null,
    [categories, selectedCategory]
  );

  // Top 3 for bestseller badge in the detail sheet
  const topDishIds = useMemo(() => {
    const sorted = [...products]
      .filter((d) => d.order_count > 0)
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 3);
    return new Map(sorted.map((d, i) => [d.id, (i + 1) as 1 | 2 | 3]));
  }, [products]);

  function handleCategorySelect(id: string) {
    setSelectedCategory(id);
    setSearch('');
    setSearchOpen(false);
  }

  function handleBack() {
    setSelectedCategory(null);
    setSearch('');
    setSearchOpen(false);
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: selectedCategory ? '#FFFFFF' : '#000000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── VIEW 1: Category Browser ── */}
      {!selectedCategory && (
        <div
          style={{
            animation: 'none',
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            * { -webkit-tap-highlight-color: transparent; }
          `}</style>

          <MenuHeader
            view="browser"
            restaurant={restaurant}
            primaryColor={primaryColor}
            itemCount={itemCount}
            onCartOpen={() => setCartOpen(true)}
          />

          <CategoryBrowser
            categories={categories}
            products={products}
            primaryColor={primaryColor}
            cartItems={items}
            onSelectCategory={handleCategorySelect}
          />
        </div>
      )}

      {/* ── VIEW 2: Dish List ── */}
      {selectedCategory && activeCategory && (
        <div
          style={{
            animation: 'slideInRight 0.25s ease both',
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(30px); }
              to   { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          <DishListView
            category={activeCategory}
            allCategories={categories}
            products={products}
            primaryColor={primaryColor}
            restaurant={restaurant}
            dietFilter={dietFilter}
            onDietFilterChange={setDietFilter}
            onBack={handleBack}
            onCategoryChange={handleCategorySelect}
            onTapDish={setSelectedDish}
            itemCount={itemCount}
            onCartOpen={() => setCartOpen(true)}
            searchOpen={searchOpen}
            onSearchToggle={() => setSearchOpen((o) => !o)}
            search={search}
            onSearch={setSearch}
          />
        </div>
      )}

      {/* Cart bar — floating bag in View 1, full bar in View 2 */}
      <CartBar
        view={selectedCategory ? 'list' : 'browser'}
        itemCount={itemCount}
        total={total}
        primaryColor={primaryColor}
        onOpen={() => setCartOpen(true)}
      />

      {/* Dish detail bottom sheet */}
      <DishDetailSheet
        product={selectedDish}
        rank={selectedDish ? (topDishIds.get(selectedDish.id) ?? null) : null}
        primaryColor={primaryColor}
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
