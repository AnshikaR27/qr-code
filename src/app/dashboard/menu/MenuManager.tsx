'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Leaf,
  Eye,
  EyeOff,
  Flame,
  Scan,
  Sparkles,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import DishForm from '@/components/dashboard/DishForm';
import CategoryManager from '@/components/dashboard/CategoryManager';
import type { Category, Product, Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
  initialCategories: Category[];
  initialProducts: Product[];
}

export default function MenuManager({ restaurant, initialCategories, initialProducts }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // Dish dialog state
  const [dishDialogOpen, setDishDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [dishCategoryId, setDishCategoryId] = useState<string>('');

  function toggleCollapse(categoryId: string) {
    setCollapsed((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  // ── Category handlers ──────────────────────────────────────────────
  function openAddCategory() {
    setEditCategory(null);
    setCatDialogOpen(true);
  }

  function openEditCategory(cat: Category) {
    setEditCategory(cat);
    setCatDialogOpen(true);
  }

  function onCategorySaved(saved: Category) {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  async function deleteCategory(cat: Category) {
    const dishCount = products.filter((p) => p.category_id === cat.id).length;
    const msg =
      dishCount > 0
        ? `Delete "${cat.name}"? This will remove the category from ${dishCount} dish${dishCount > 1 ? 'es' : ''} (they won't be deleted).`
        : `Delete category "${cat.name}"?`;

    if (!confirm(msg)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      // Null out category_id for products in this category
      setProducts((prev) =>
        prev.map((p) => (p.category_id === cat.id ? { ...p, category_id: null } : p))
      );
      toast.success('Category deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }

  // ── Dish handlers ──────────────────────────────────────────────────
  function openAddDish(categoryId = '') {
    setEditProduct(null);
    setDishCategoryId(categoryId);
    setDishDialogOpen(true);
  }

  function openEditDish(product: Product) {
    setEditProduct(product);
    setDishCategoryId(product.category_id ?? '');
    setDishDialogOpen(true);
  }

  function onDishSaved(saved: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  async function deleteDish(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Dish deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete dish');
    }
  }

  async function toggleAvailability(product: Product) {
    const next = !product.is_available;
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_available: next } : p))
    );
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .update({ is_available: next })
        .eq('id', product.id);
      if (error) throw error;
      toast.success(next ? `${product.name} is now available` : `${product.name} marked unavailable`);
    } catch (err: unknown) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !next } : p))
      );
      toast.error(err instanceof Error ? err.message : 'Failed to update availability');
    }
  }

  // ── Batch AI describe ──────────────────────────────────────────────
  const [autoDescProgress, setAutoDescProgress] = useState<{ current: number; total: number } | null>(null);

  async function autoDescribeAll() {
    const undescribed = products.filter((p) => !p.description?.trim() && p.name.trim().length >= 2);
    if (undescribed.length === 0) {
      toast.info('All dishes already have descriptions');
      return;
    }
    setAutoDescProgress({ current: 0, total: undescribed.length });
    let succeeded = 0;
    for (let i = 0; i < undescribed.length; i++) {
      const product = undescribed[i];
      setAutoDescProgress({ current: i + 1, total: undescribed.length });
      try {
        const categoryName = categories.find((c) => c.id === product.category_id)?.name;
        const res = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dishName: product.name, categoryName }),
        });
        if (res.ok) {
          const data = await res.json() as { description?: string };
          if (data.description) {
            const supabase = createClient();
            await supabase.from('products').update({ description: data.description }).eq('id', product.id);
            setProducts((prev) =>
              prev.map((p) => p.id === product.id ? { ...p, description: data.description ?? null } : p)
            );
            succeeded++;
          }
        }
      } catch { /* skip */ }
      if (i < undescribed.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    setAutoDescProgress(null);
    toast.success(`Generated ${succeeded} of ${undescribed.length} descriptions`);
  }

  // ── Grouping ───────────────────────────────────────────────────────
  const categorisedProducts = categories.map((cat) => ({
    category: cat,
    products: products.filter((p) => p.category_id === cat.id),
  }));
  const uncategorised = products.filter((p) => !p.category_id);

  const totalDishes = products.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {totalDishes} {totalDishes === 1 ? 'dish' : 'dishes'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/scan">
              <Scan className="w-4 h-4 mr-2" />
              AI Scanner
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={autoDescribeAll}
            disabled={!!autoDescProgress}
            title="Auto-generate descriptions for dishes that don't have one"
          >
            {autoDescProgress ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {autoDescProgress.current}/{autoDescProgress.total}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Auto-describe
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={openAddCategory}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button size="sm" onClick={() => openAddDish()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Dish
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {categories.length === 0 && products.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground font-medium">No menu yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a category first, then add dishes — or use the AI Scanner to import from a photo.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" onClick={openAddCategory}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/menu/scan">
                <Scan className="w-4 h-4 mr-2" />
                AI Scanner
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {categorisedProducts.map(({ category, products: catProducts }) => (
          <CategorySection
            key={category.id}
            category={category}
            products={catProducts}
            allCategories={categories}
            restaurantId={restaurant.id}
            collapsed={!!collapsed[category.id]}
            onToggleCollapse={() => toggleCollapse(category.id)}
            onEditCategory={() => openEditCategory(category)}
            onDeleteCategory={() => deleteCategory(category)}
            onAddDish={() => openAddDish(category.id)}
            onEditDish={openEditDish}
            onDeleteDish={deleteDish}
            onToggleAvailability={toggleAvailability}
          />
        ))}

        {/* Uncategorised */}
        {uncategorised.length > 0 && (
          <CategorySection
            category={null}
            products={uncategorised}
            allCategories={categories}
            restaurantId={restaurant.id}
            collapsed={!!collapsed['__uncategorised__']}
            onToggleCollapse={() => toggleCollapse('__uncategorised__')}
            onEditCategory={() => {}}
            onDeleteCategory={() => {}}
            onAddDish={() => openAddDish('')}
            onEditDish={openEditDish}
            onDeleteDish={deleteDish}
            onToggleAvailability={toggleAvailability}
          />
        )}
      </div>

      {/* Dialogs */}
      <CategoryManager
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
        onSaved={onCategorySaved}
        restaurantId={restaurant.id}
        editCategory={editCategory}
      />

      <DishForm
        open={dishDialogOpen}
        onClose={() => setDishDialogOpen(false)}
        onSaved={onDishSaved}
        restaurantId={restaurant.id}
        categories={categories}
        editProduct={editProduct}
      />
    </div>
  );
}

// ── CategorySection ────────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: Category | null;
  products: Product[];
  allCategories: Category[];
  restaurantId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddDish: () => void;
  onEditDish: (p: Product) => void;
  onDeleteDish: (p: Product) => void;
  onToggleAvailability: (p: Product) => void;
}

function CategorySection({
  category,
  products,
  collapsed,
  onToggleCollapse,
  onEditCategory,
  onDeleteCategory,
  onAddDish,
  onEditDish,
  onDeleteDish,
  onToggleAvailability,
}: CategorySectionProps) {
  const isUncategorised = !category;

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Category header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <button
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          onClick={onToggleCollapse}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-semibold text-sm truncate">
            {category?.name ?? 'Uncategorised'}
          </span>
          {category?.name_hindi && (
            <span className="text-xs text-muted-foreground truncate">{category.name_hindi}</span>
          )}
          <Badge variant="secondary" className="ml-1 flex-shrink-0">
            {products.length}
          </Badge>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isUncategorised && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEditCategory}
                title="Edit category"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDeleteCategory}
                title="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddDish}>
            <Plus className="w-3 h-3 mr-1" />
            Add Dish
          </Button>
        </div>
      </div>

      {/* Dish list */}
      {!collapsed && (
        <div>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">
              No dishes yet.{' '}
              <button className="underline hover:no-underline" onClick={onAddDish}>
                Add one
              </button>
            </p>
          ) : (
            <ul className="divide-y">
              {products.map((product) => (
                <DishRow
                  key={product.id}
                  product={product}
                  onEdit={() => onEditDish(product)}
                  onDelete={() => onDeleteDish(product)}
                  onToggleAvailability={() => onToggleAvailability(product)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── DishRow ────────────────────────────────────────────────────────────────────

interface DishRowProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}

function DishRow({ product, onEdit, onDelete, onToggleAvailability }: DishRowProps) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors',
        !product.is_available && 'opacity-60'
      )}
    >
      {/* Thumbnail */}
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 rounded-md object-cover flex-shrink-0 border"
        />
      ) : (
        <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0 border flex items-center justify-center">
          <span className="text-lg">🍽️</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Veg/Non-veg dot */}
          <span
            className={cn(
              'w-3 h-3 rounded-sm border-2 flex-shrink-0',
              product.is_veg ? 'border-green-600' : 'border-red-600'
            )}
          >
            <span
              className={cn(
                'block w-1.5 h-1.5 rounded-full m-auto translate-y-[1px]',
                product.is_veg ? 'bg-green-600' : 'bg-red-600'
              )}
            />
          </span>
          <span className="text-sm font-medium truncate">{product.name}</span>
          {product.name_hindi && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {product.name_hindi}
            </span>
          )}
          {product.is_jain && (
            <Badge variant="outline" className="text-xs py-0 h-4 flex-shrink-0">
              Jain
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm font-semibold text-gray-800">{formatPrice(product.price)}</span>
          {product.spice_level > 0 && (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: product.spice_level }).map((_, i) => (
                <Flame key={i} className="w-3 h-3 text-orange-500" />
              ))}
            </span>
          )}
          {product.allergens.length > 0 && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Contains: {product.allergens.join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Availability toggle */}
        <button
          onClick={onToggleAvailability}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
            product.is_available
              ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          )}
          title={product.is_available ? 'Mark as unavailable' : 'Mark as available'}
        >
          {product.is_available ? (
            <>
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Available</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3" />
              <span className="hidden sm:inline">Nahi hai</span>
            </>
          )}
        </button>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit dish">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete dish"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </li>
  );
}
