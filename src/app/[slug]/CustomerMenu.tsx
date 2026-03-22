'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import MenuHeader from '@/components/menu/MenuHeader';
import CategoryTabs from '@/components/menu/CategoryTabs';
import FilterBar from '@/components/menu/FilterBar';
import SearchBar from '@/components/menu/SearchBar';
import DishCard from '@/components/menu/DishCard';
import CartSheet from '@/components/menu/CartSheet';
import { useCart } from '@/hooks/useCart';
import { cn, formatPrice } from '@/lib/utils';
import type { Category, Product, Restaurant } from '@/types';
import type { DietFilter } from '@/lib/constants';

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
  const prevCountRef = useRef(0);
  const [cartVisible, setCartVisible] = useState(false);
  const [cartBouncing, setCartBouncing] = useState(false);

  const { items, getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();
  const total = getTotal();
  const p = restaurant.primary_color;

  // Spring bounce when first item is added, smooth slide for subsequent changes
  useEffect(() => {
    const prev = prevCountRef.current;
    if (itemCount > 0 && prev === 0) {
      setCartVisible(true);
      setCartBouncing(true);
      setTimeout(() => setCartBouncing(false), 600);
    } else if (itemCount === 0) {
      setCartVisible(false);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  // Popular threshold: top 10% by order_count
  const popularThreshold = useMemo(() => {
    const counts = products.map((p) => p.order_count).filter((c) => c > 0);
    if (!counts.length) return Infinity;
    counts.sort((a, b) => b - a);
    return counts[Math.max(0, Math.floor(counts.length * 0.1) - 1)];
  }, [products]);

  const filtered = useMemo(() => {
    let r = products;
    if (activeCategory !== 'all') r = r.filter((p) => p.category_id === activeCategory);
    if (dietFilter === 'veg')     r = r.filter((p) => p.is_veg);
    if (dietFilter === 'non_veg') r = r.filter((p) => !p.is_veg);
    if (dietFilter === 'jain')    r = r.filter((p) => p.is_jain);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_hindi && p.name_hindi.toLowerCase().includes(q))
      );
    }
    return r;
  }, [products, activeCategory, dietFilter, search]);

  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return [{ category: null as Category | null, items: filtered }];
    const groups: { category: Category | null; items: Product[] }[] = [];
    categories.forEach((cat) => {
      const catItems = filtered.filter((p) => p.category_id === cat.id);
      if (catItems.length) groups.push({ category: cat, items: catItems });
    });
    const uncategorised = filtered.filter((p) => !p.category_id);
    if (uncategorised.length) groups.push({ category: null, items: uncategorised });
    return groups;
  }, [filtered, categories, activeCategory]);

  return (
    <div
      className="min-h-screen pb-32"
      style={{ backgroundColor: `${p}07` }}
    >
      {/* Hero header */}
      <MenuHeader restaurant={restaurant} />

      {/* Sticky controls */}
      <div className="sticky top-0 z-10" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={setActiveCategory}
          primaryColor={p}
        />
        <FilterBar active={dietFilter} onChange={setDietFilter} primaryColor={p} />
        <SearchBar value={search} onChange={setSearch} primaryColor={p} />
      </div>

      {/* Dish list */}
      <div className="px-4 pt-6 space-y-8">
        {grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-5xl">🔍</div>
            <p className="font-black text-gray-600 text-lg">Nothing found</p>
            <p className="text-sm text-gray-400 text-center">
              Try adjusting your search or filter
            </p>
          </div>
        )}

        {grouped.map(({ category, items: groupItems }, gi) => (
          <section key={category?.id ?? `g-${gi}`}>
            {/* Section header */}
            {activeCategory === 'all' && (
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-1.5 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p }}
                />
                <div>
                  <h2 className="text-[16px] font-black text-gray-900 leading-tight">
                    {category?.name ?? 'Other'}
                  </h2>
                  {category?.name_hindi && (
                    <p className="text-xs font-medium text-gray-400 mt-0.5">
                      {category.name_hindi}
                    </p>
                  )}
                </div>
                <div
                  className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${p}15`, color: p }}
                >
                  {groupItems.length}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {groupItems.map((product, pi) => (
                <div
                  key={product.id}
                  style={{ animationDelay: `${pi * 50}ms` }}
                >
                  <DishCard
                    product={product}
                    isPopular={product.order_count > 0 && product.order_count >= popularThreshold}
                    primaryColor={p}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Cart bar — spring bounce on first item, smooth slide after */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-2',
          cartBouncing ? 'animate-cart-bounce' : cartVisible ? 'cart-spring-enter' : 'cart-spring-exit',
          !cartVisible && !cartBouncing ? 'pointer-events-none' : '',
        )}
        style={
          !cartBouncing
            ? {
                transform: cartVisible ? 'translateY(0)' : 'translateY(110%)',
                transition: cartVisible
                  ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'transform 0.3s ease-in',
              }
            : {}
        }
      >
        {/* Frosted glass backdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${p}18 0%, transparent 100%)`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        <button
          onClick={() => setCartOpen(true)}
          className="relative w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white active:scale-[0.97] transition-transform"
          style={{
            background: `linear-gradient(135deg, ${restaurant.secondary_color} 0%, ${p} 100%)`,
            boxShadow: `0 8px 32px ${p}60, 0 2px 8px rgba(0,0,0,0.15)`,
          }}
        >
          {/* Left */}
          <span className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
            >
              {itemCount}
            </span>
            <span className="text-[15px] font-black tracking-wide">View Cart</span>
          </span>

          {/* Right */}
          <span className="flex items-center gap-2.5">
            <span className="text-[15px] font-black">{formatPrice(total)}</span>
            <ShoppingBag className="w-5 h-5 opacity-90" />
          </span>
        </button>
      </div>

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        tableId={tableId}
      />
    </div>
  );
}
