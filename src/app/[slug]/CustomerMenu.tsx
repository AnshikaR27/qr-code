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

  const { items, getTotal, getItemCount } = useCart();
  const itemCount = getItemCount();
  const total = getTotal();
  const p = restaurant.primary_color;

  useEffect(() => {
    const prev = prevCountRef.current;
    if (itemCount > 0 && prev === 0) setCartVisible(true);
    else if (itemCount === 0) setCartVisible(false);
    prevCountRef.current = itemCount;
  }, [itemCount]);

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
    <div className="min-h-screen bg-gray-100 pb-28">
      {/* Header */}
      <MenuHeader restaurant={restaurant} />

      {/* Sticky controls */}
      <div className="sticky top-0 z-10 shadow-sm">
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={setActiveCategory}
          primaryColor={p}
        />
        <FilterBar active={dietFilter} onChange={setDietFilter} primaryColor={p} />
        <SearchBar value={search} onChange={setSearch} primaryColor={p} />
      </div>

      {/* Dish sections */}
      <div className="mt-2 space-y-2">
        {grouped.length === 0 && (
          <div className="bg-white flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">🔍</div>
            <p className="font-bold text-gray-600">No results found</p>
            <p className="text-sm text-gray-400 text-center px-8">
              Try adjusting your search or filter
            </p>
          </div>
        )}

        {grouped.map(({ category, items: groupItems }, gi) => (
          <div key={category?.id ?? `g-${gi}`} className="bg-white">
            {/* Section header */}
            {activeCategory === 'all' && (
              <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
                <div>
                  <h2 className="text-[15px] font-black text-gray-900">
                    {category?.name ?? 'Other'}
                  </h2>
                  {category?.name_hindi && (
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                      {category.name_hindi}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-400">
                  {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Dish cards — no gaps, just border-b separators inside DishCard */}
            {groupItems.map((product, pi) => (
              <DishCard
                key={product.id}
                product={product}
                isPopular={product.order_count > 0 && product.order_count >= popularThreshold}
                primaryColor={p}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Cart bottom bar */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-2 transition-transform duration-300',
          cartVisible ? 'translate-y-0' : 'translate-y-[120%] pointer-events-none',
        )}
      >
        <button
          onClick={() => setCartOpen(true)}
          className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white active:scale-[0.98] transition-transform shadow-2xl"
          style={{ backgroundColor: p, boxShadow: `0 8px 30px ${p}70` }}
        >
          <span className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black">
              {itemCount}
            </span>
            <span className="text-[15px] font-black tracking-wide">View Cart</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-black">{formatPrice(total)}</span>
            <ShoppingBag className="w-4.5 h-4.5 opacity-90" />
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
