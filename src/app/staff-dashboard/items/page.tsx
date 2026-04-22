'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, Leaf, UtensilsCrossed } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import type { Category, Product } from '@/types';

export default function KitchenItemsPage() {
  const { restaurant } = useStaff();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [catRes, prodRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order'),
      supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
  }, [restaurant.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleAvailability(product: Product) {
    const next = !product.is_available;
    setToggling(product.id);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_available: next } : p))
    );

    try {
      const res = await fetch('/api/staff/items/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, is_available: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? `${product.name} is now available` : `${product.name} marked unavailable`);
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !next } : p))
      );
      toast.error('Failed to update availability');
    } finally {
      setToggling(null);
    }
  }

  const filtered = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const unavailableCount = products.filter((p) => !p.is_available).length;

  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((p) => p.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const uncategorized = filtered.filter((p) => !p.category_id);

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6" /> Item Availability
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Toggle items on or off for customers
          {unavailableCount > 0 && (
            <span className="ml-2 text-red-600 font-medium">
              · {unavailableCount} unavailable
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
        />
      </div>

      {/* Items by category */}
      {grouped.map(({ category, items }) => (
        <div key={category.id}>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {category.name}
          </h2>
          <div className="bg-white rounded-xl border divide-y">
            {items.map((product) => (
              <ItemRow
                key={product.id}
                product={product}
                isToggling={toggling === product.id}
                onToggle={() => toggleAvailability(product)}
              />
            ))}
          </div>
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Other
          </h2>
          <div className="bg-white rounded-xl border divide-y">
            {uncategorized.map((product) => (
              <ItemRow
                key={product.id}
                product={product}
                isToggling={toggling === product.id}
                onToggle={() => toggleAvailability(product)}
              />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No items found</p>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  product,
  isToggling,
  onToggle,
}: {
  product: Product;
  isToggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 gap-3',
        !product.is_available && 'bg-red-50/50',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-3 h-3 rounded-full border-2 flex-shrink-0',
            product.is_veg
              ? 'border-green-600 bg-green-600'
              : 'border-red-600 bg-red-600',
          )}
        />
        <div className="min-w-0">
          <p className={cn(
            'text-sm font-medium truncate',
            !product.is_available && 'line-through text-muted-foreground',
          )}>
            {product.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatPrice(product.price)}</p>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={isToggling}
        className={cn(
          'relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200',
          product.is_available ? 'bg-green-500' : 'bg-gray-300',
          isToggling && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
            product.is_available && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}
