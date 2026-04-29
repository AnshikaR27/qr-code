'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChefHat } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Category, Product } from '@/types';

interface ItemAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
}

export default function ItemAvailabilityModal({
  open,
  onOpenChange,
  restaurantId,
}: ItemAvailabilityModalProps) {
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
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
      supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
  }, [restaurantId]);

  useEffect(() => {
    if (open) {
      fetchData();
      setSearch('');
    }
  }, [open, fetchData]);

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
      toast.success(
        next ? `${product.name} is now available` : `${product.name} marked unavailable`,
      );

      if (!next) {
        checkPendingOrders(product);
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !next } : p))
      );
      toast.error('Failed to update availability');
    } finally {
      setToggling(null);
    }
  }

  async function checkPendingOrders(product: Product) {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('order_items')
        .select('*, order:orders!inner(restaurant_id, status, payment_method)', {
          count: 'exact',
          head: true,
        })
        .eq('product_id', product.id)
        .eq('order.restaurant_id', restaurantId)
        .is('order.payment_method', null)
        .neq('order.status', 'cancelled')
        .neq('status', 'voided');

      if (count && count > 0) {
        toast.info(
          `${count} pending order${count > 1 ? 's' : ''} contain${count === 1 ? 's' : ''} ${product.name} — flag the cashier.`,
          { duration: 6000 },
        );
      }
    } catch { /* best effort */ }
  }

  const filtered = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((p) => p.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const uncategorized = filtered.filter((p) => !p.category_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            86 List
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-2">
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {grouped.map(({ category, items }) => (
            <div key={category.id}>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {category.name}
              </h2>
              <div className="bg-white rounded-xl border divide-y">
                {items.map((product) => (
                  <ToggleRow
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
                  <ToggleRow
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
            <div className="text-center py-12 text-muted-foreground">
              <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No items found</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  product,
  isToggling,
  onToggle,
}: {
  product: Product;
  isToggling: boolean;
  onToggle: () => void;
}) {
  const unavailable = !product.is_available;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 gap-3',
        unavailable && 'bg-red-50/60',
      )}
    >
      <div className={cn('flex items-center gap-3 min-w-0', unavailable && 'opacity-50')}>
        <div
          className={cn(
            'w-3 h-3 rounded-full border-2 flex-shrink-0',
            product.is_veg
              ? 'border-green-600 bg-green-600'
              : 'border-red-600 bg-red-600',
          )}
        />
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-medium truncate',
              unavailable && 'line-through text-gray-400',
            )}
          >
            {product.name}
          </p>
          <span className={cn('text-xs', unavailable ? 'text-gray-400' : 'text-muted-foreground')}>
            {formatPrice(product.price)}
          </span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={isToggling}
        className={cn(
          'relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200',
          product.is_available ? 'bg-green-500' : 'bg-red-400',
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
