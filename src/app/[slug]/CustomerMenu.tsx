'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { buildMenuTokens } from '@/lib/tokens';
import MenuNavbar from '@/components/menu/MenuNavbar';
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
  const tokens = useMemo(
    () => buildMenuTokens(restaurant.design_tokens),
    [restaurant.design_tokens]
  );

  // Expose per-restaurant token colors for the global Toaster to pick up
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-success', tokens.success);
    document.documentElement.style.setProperty('--toast-error', tokens.error);
    document.documentElement.style.setProperty('--text-muted-placeholder', tokens.textMuted);
    return () => {
      document.documentElement.style.removeProperty('--toast-success');
      document.documentElement.style.removeProperty('--toast-error');
      document.documentElement.style.removeProperty('--text-muted-placeholder');
    };
  }, [tokens.success, tokens.error, tokens.textMuted]);

  const reduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Category blur transition — tracks which section was just jumped to via tab tap
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);

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

  const scrollToCategory = useCallback((id: string) => {
    // Category blur transition: blur-in on the target section
    if (!reduced) {
      setJumpTarget(id);
      setTimeout(() => setJumpTarget(null), 300);
    }
    const el = sectionRefs.current.get(id);
    if (el) {
      const offset = 177;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    setActiveTab(id);
  }, [reduced]);

  function getFilteredProducts(categoryId: string): Product[] {
    let ps = products.filter((p) => p.category_id === categoryId);
    if (dietFilter === 'veg') ps = ps.filter((p) => p.is_veg);
    else if (dietFilter === 'non_veg') ps = ps.filter((p) => !p.is_veg);
    else if (dietFilter === 'jain') ps = ps.filter((p) => p.is_jain);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      ps = ps.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'popular') ps = [...ps].sort((a, b) => b.order_count - a.order_count);
    else if (sortBy === 'price_asc') ps = [...ps].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') ps = [...ps].sort((a, b) => b.price - a.price);
    return ps;
  }

  const isSearching = searchQuery.trim().length > 0;
  const hasAnyResults = isSearching
    ? categories.some((cat) => getFilteredProducts(cat.id).length > 0)
    : true;

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: tokens.bg,
        backgroundImage: `radial-gradient(circle, ${tokens.primary}0f 1px, transparent 1px)`,
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
        /* Category tab underline slides smoothly */
        .cat-tab-btn {
          transition: color 0.2s ease, border-color 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .menu-search-input::placeholder { color: var(--text-muted-placeholder); }
      `}</style>

      {/* ── Sticky header group: Navbar + Tabs + Search ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <MenuNavbar
          restaurant={restaurant}
          tokens={tokens}
          itemCount={itemCount}
          onCartOpen={() => setCartOpen(true)}
        />
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          tokens={tokens}
          onSelect={scrollToCategory}
        />
        {/* Search bar */}
        <div
          style={{
            backgroundColor: tokens.navBg,
            padding: '8px 16px 10px',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Search icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.textMuted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 12, flexShrink: 0, pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="menu-search-input"
              style={{
                width: '100%',
                padding: '9px 36px 9px 36px',
                borderRadius: 12,
                border: `1px solid ${tokens.border}`,
                backgroundColor: tokens.cardBg,
                color: tokens.text,
                fontFamily: tokens.fontBody,
                fontSize: 14,
                outline: 'none',
              }}
            />
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.textMuted,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrolling content ── */}
      <div style={{ paddingBottom: itemCount > 0 ? 100 : 40 }}>
        {isSearching && !hasAnyResults && (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              fontFamily: tokens.fontBody,
              fontSize: 14,
              color: tokens.textMuted,
            }}
          >
            No items found
          </div>
        )}
        {categories.map((cat) => {
          const filtered = getFilteredProducts(cat.id);
          if (filtered.length === 0 && (dietFilter !== 'all' || isSearching)) return null;

          return (
            <div
              key={cat.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(cat.id, el);
                else sectionRefs.current.delete(cat.id);
              }}
              data-category-id={cat.id}
              className={jumpTarget === cat.id ? 'section-blur-enter' : undefined}
            >
              <SectionHeading category={cat} tokens={tokens} />

              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '8px 16px 16px',
                    fontFamily: tokens.fontBody,
                    fontSize: 13,
                    color: tokens.textMuted,
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
                    tokens={tokens}
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
        tokens={tokens}
        dietFilter={dietFilter}
        onDietFilterChange={setDietFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {/* ── Cart bar (fixed bottom) ── */}
      <CartBar
        tokens={tokens}
        itemCount={itemCount}
        total={total}
        onOpen={() => setCartOpen(true)}
      />

      {/* ── Dish detail bottom sheet ── */}
      <DishDetailSheet
        product={selectedDish}
        tokens={tokens}
        isBestseller={selectedDish ? topDishIds.has(selectedDish.id) : false}
        onClose={() => setSelectedDish(null)}
      />

      {/* ── Cart sheet ── */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        tableId={tableId}
        tokens={tokens}
      />
    </div>
  );
}
