'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { generatePalette } from '@/lib/palette';
import MenuNavbar from '@/components/menu/MenuNavbar';
import MenuDropdown from '@/components/menu/MenuDropdown';
import CategoryTabs from '@/components/menu/CategoryTabs';
import SectionHeading from '@/components/menu/SectionHeading';
import DishCard from '@/components/menu/DishCard';
import DishDetailSheet from '@/components/menu/DishDetailSheet';
import FloatingFilters, { type SortBy } from '@/components/menu/FloatingFilters';
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
  const palette = useMemo(
    () =>
      generatePalette(
        restaurant.primary_color || '#8B6914',
        restaurant.secondary_color || '#3E2B1A'
      ),
    [restaurant.primary_color, restaurant.secondary_color]
  );

  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const { getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();
  const total = getTotal();

  // Top 3 bestsellers by order_count
  const topDishIds = useMemo(
    () =>
      new Set(
        [...products]
          .filter((p) => p.order_count > 0)
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 3)
          .map((p) => p.id)
      ),
    [products]
  );

  // Section refs for scroll tracking + scroll-to
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // IntersectionObserver — update active tab as sections scroll into view
  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id) setActiveTab(id);
          }
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
    );

    const refs = sectionRefs.current;
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current.get(id);
    if (el) {
      // Offset for sticky header: navbar (~76px) + dropdown (~52px) + tabs (~49px)
      const offset = 177;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    setActiveTab(id);
  }

  function getFilteredProducts(categoryId: string): Product[] {
    let ps = products.filter((p) => p.category_id === categoryId);
    if (dietFilter === 'veg') ps = ps.filter((p) => p.is_veg);
    else if (dietFilter === 'non_veg') ps = ps.filter((p) => !p.is_veg);
    else if (dietFilter === 'jain') ps = ps.filter((p) => p.is_jain);
    if (sortBy === 'popular') ps = [...ps].sort((a, b) => b.order_count - a.order_count);
    else if (sortBy === 'price_asc') ps = [...ps].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') ps = [...ps].sort((a, b) => b.price - a.price);
    return ps;
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: palette.pageBg,
        backgroundImage: `radial-gradient(circle, ${palette.textureColor} 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        position: 'relative',
      }}
    >
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes addPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* ── Sticky header group: Navbar + Dropdown + Tabs ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <MenuNavbar
          restaurant={restaurant}
          palette={palette}
          itemCount={itemCount}
          onCartOpen={() => setCartOpen(true)}
        />
        <MenuDropdown
          categories={categories}
          activeCategoryId={activeTab}
          palette={palette}
          onSelect={scrollToCategory}
        />
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          palette={palette}
          onSelect={scrollToCategory}
        />
      </div>

      {/* ── Scrolling content ── */}
      <div style={{ paddingBottom: itemCount > 0 ? 100 : 40 }}>
        {categories.map((cat) => {
          const filtered = getFilteredProducts(cat.id);
          // Hide section entirely if filter is active and no dishes match
          if (filtered.length === 0 && dietFilter !== 'all') return null;

          return (
            <div
              key={cat.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(cat.id, el);
                else sectionRefs.current.delete(cat.id);
              }}
              data-category-id={cat.id}
            >
              <SectionHeading category={cat} palette={palette} />

              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '8px 16px 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: palette.midLight,
                    textAlign: 'center',
                  }}
                >
                  No dishes in this category
                </div>
              ) : (
                filtered.map((dish, i) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    palette={palette}
                    index={i}
                    isBestseller={topDishIds.has(dish.id)}
                    onTap={() => setSelectedDish(dish)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* ── Floating Filters pill ── */}
      <FloatingFilters
        palette={palette}
        dietFilter={dietFilter}
        onDietFilterChange={setDietFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {/* ── Cart bar (fixed bottom) ── */}
      <CartBar
        palette={palette}
        itemCount={itemCount}
        total={total}
        onOpen={() => setCartOpen(true)}
      />

      {/* ── Dish detail bottom sheet ── */}
      <DishDetailSheet
        product={selectedDish}
        palette={palette}
        isBestseller={selectedDish ? topDishIds.has(selectedDish.id) : false}
        onClose={() => setSelectedDish(null)}
      />

      {/* ── Cart sheet ── */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        tableId={tableId}
        palette={palette}
      />
    </div>
  );
}
