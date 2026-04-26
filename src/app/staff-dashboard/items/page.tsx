'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, UtensilsCrossed, Plus, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import { hasPermission } from '@/lib/staff-permissions';
import { Button } from '@/components/ui/button';
import DishForm from '@/components/dashboard/DishForm';
import CategoryManager from '@/components/dashboard/CategoryManager';
import type { Category, Product } from '@/types';

export default function KitchenItemsPage() {
  const { staff, restaurant } = useStaff();

  const canEditMenu = hasPermission(staff.role, 'menu:edit_items');
  const canEditCategories = hasPermission(staff.role, 'menu:edit_categories');
  const canToggleStock = hasPermission(staff.role, 'menu:mark_out_of_stock');

  if (!canEditMenu && staff.role !== 'kitchen') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <p className="text-sm">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <ItemsContent
      canEditMenu={canEditMenu}
      canEditCategories={canEditCategories}
      canToggleStock={canToggleStock}
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
    />
  );
}

function ItemsContent({
  canEditMenu,
  canEditCategories,
  canToggleStock,
  restaurantId,
  restaurantSlug,
}: {
  canEditMenu: boolean;
  canEditCategories: boolean;
  canToggleStock: boolean;
  restaurantId: string;
  restaurantSlug: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const [dishDialogOpen, setDishDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

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

  async function deleteItem(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      const res = await fetch(`/api/staff/menu/items?id=${product.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Dish deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete dish');
    }
  }

  async function deleteCategory(cat: Category) {
    const dishCount = products.filter((p) => p.category_id === cat.id).length;
    const msg = dishCount > 0
      ? `Delete "${cat.name}"? ${dishCount} dish${dishCount > 1 ? 'es' : ''} will become uncategorised.`
      : `Delete category "${cat.name}"?`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/staff/menu/categories?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setProducts((prev) =>
        prev.map((p) => (p.category_id === cat.id ? { ...p, category_id: null } : p))
      );
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6" />
            {canEditMenu ? 'Menu Editor' : 'Item Availability'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canEditMenu ? 'Add, edit, and manage menu items' : 'Toggle items on or off for customers'}
            {unavailableCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {unavailableCount} unavailable
              </span>
            )}
          </p>
        </div>
        {canEditMenu && (
          <div className="flex gap-2 flex-shrink-0">
            {canEditCategories && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditCategory(null); setCatDialogOpen(true); }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Category
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => { setEditProduct(null); setDishDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Dish
            </Button>
          </div>
        )}
      </div>

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

      {grouped.map(({ category, items }) => (
        <div key={category.id}>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {category.name}
            </h2>
            {canEditCategories && (
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditCategory(category); setCatDialogOpen(true); }}
                  className="p-1 rounded hover:bg-gray-100 text-muted-foreground"
                  title="Edit category"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteCategory(category)}
                  className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border divide-y">
            {items.map((product) => (
              <ItemRow
                key={product.id}
                product={product}
                isToggling={toggling === product.id}
                onToggle={canToggleStock ? () => toggleAvailability(product) : undefined}
                onEdit={canEditMenu ? () => { setEditProduct(product); setDishDialogOpen(true); } : undefined}
                onDelete={canEditMenu ? () => deleteItem(product) : undefined}
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
                onToggle={canToggleStock ? () => toggleAvailability(product) : undefined}
                onEdit={canEditMenu ? () => { setEditProduct(product); setDishDialogOpen(true); } : undefined}
                onDelete={canEditMenu ? () => deleteItem(product) : undefined}
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

      {canEditMenu && (
        <>
          <DishForm
            open={dishDialogOpen}
            onClose={() => setDishDialogOpen(false)}
            onSaved={(saved) => {
              setProducts((prev) => {
                const idx = prev.findIndex((p) => p.id === saved.id);
                if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
                return [...prev, saved];
              });
            }}
            restaurantId={restaurantId}
            categories={categories}
            editProduct={editProduct}
            useStaffApi
            hidePriceEdit
          />
          {canEditCategories && (
            <CategoryManager
              open={catDialogOpen}
              onClose={() => setCatDialogOpen(false)}
              onSaved={(saved) => {
                setCategories((prev) => {
                  const idx = prev.findIndex((c) => c.id === saved.id);
                  if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
                  return [...prev, saved];
                });
              }}
              restaurantId={restaurantId}
              editCategory={editCategory}
              useStaffApi
            />
          )}
        </>
      )}
    </div>
  );
}

function ItemRow({
  product,
  isToggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  product: Product;
  isToggling: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

      <div className="flex items-center gap-2 flex-shrink-0">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground"
            title="Edit dish"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
            title="Delete dish"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {onToggle && (
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
        )}
      </div>
    </div>
  );
}
