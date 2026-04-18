'use client';

import { useRef, useState } from 'react';
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
  Download,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice, cdnImg } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import DishForm from '@/components/dashboard/DishForm';
import CategoryManager from '@/components/dashboard/CategoryManager';
import type { Category, Product, Restaurant } from '@/types';

// ── Persistence helpers (module-level, no stale closure risk) ─────────────────

async function persistCategoryOrder(cats: Category[]) {
  const supabase = createClient();
  try {
    await Promise.all(
      cats.map((c) =>
        supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id)
      )
    );
  } catch {
    toast.error('Failed to save category order');
  }
}

async function persistDishChanges(dishes: Product[]) {
  if (!dishes.length) return;
  const supabase = createClient();
  try {
    await Promise.all(
      dishes.map((p) =>
        supabase
          .from('products')
          .update({ sort_order: p.sort_order, category_id: p.category_id })
          .eq('id', p.id)
      )
    );
  } catch {
    toast.error('Failed to save dish order');
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  restaurant: Restaurant;
  initialCategories: Category[];
  initialProducts: Product[];
}

// ── Main component ────────────────────────────────────────────────────────────

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

  // Drag state
  const [activeDrag, setActiveDrag] = useState<
    | { type: 'category'; item: Category }
    | { type: 'dish'; item: Product }
    | null
  >(null);
  // Capture original category_id at drag start so we know what to clean up after cross-cat move
  const originalCategoryIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !next } : p))
      );
      toast.error(err instanceof Error ? err.message : 'Failed to update availability');
    }
  }

  // ── Bulk delete uncategorised ───────────────────────────────────────
  async function deleteAllUncategorised() {
    const uncats = products.filter((p) => !p.category_id);
    if (uncats.length === 0) return;
    if (!confirm(`Delete all ${uncats.length} uncategorised dish${uncats.length !== 1 ? 'es' : ''}? This cannot be undone.`)) return;

    try {
      const supabase = createClient();
      const ids = uncats.map((p) => p.id);
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.category_id));
      toast.success(`${uncats.length} uncategorised dish${uncats.length !== 1 ? 'es' : ''} deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete dishes');
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

  // ── Export CSV ─────────────────────────────────────────────────────
  function exportCSV() {
    if (products.length === 0) {
      toast.error('No dishes to export');
      return;
    }
    const catMap: Record<string, string> = {};
    for (const c of categories) catMap[c.id] = c.name;

    const headers = ['Name', 'Name (Hindi)', 'Category', 'Price', 'Veg', 'Jain', 'Dietary Tags', 'Available', 'Spice Level', 'Description'];
    const csvRows = products.map((p) =>
      [
        p.name,
        p.name_hindi ?? '',
        p.category_id ? catMap[p.category_id] ?? '' : '',
        p.price,
        p.is_veg ? 'Yes' : 'No',
        p.is_jain ? 'Yes' : 'No',
        p.dietary_tags ?? '',
        p.is_available ? 'Yes' : 'No',
        p.spice_level,
        p.description ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-${restaurant.slug ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Drag handlers ──────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as string | undefined;
    if (type === 'category') {
      const cat = categories.find((c) => c.id === event.active.id);
      if (cat) setActiveDrag({ type: 'category', item: cat });
    } else if (type === 'dish') {
      const product = products.find((p) => p.id === event.active.id);
      if (product) {
        originalCategoryIdRef.current = product.category_id ?? null;
        setActiveDrag({ type: 'dish', item: product });
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'dish') return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    // Determine which category the over item belongs to
    let targetCategoryId: string | null | undefined;
    if (over.data.current?.type === 'dish') {
      const overProduct = products.find((p) => p.id === overId);
      targetCategoryId = overProduct?.category_id ?? null;
    } else if (over.data.current?.type === 'category') {
      // Hovering over a category section (e.g. an empty one) — move into it
      targetCategoryId = overId;
    } else {
      return;
    }

    const activeProduct = products.find((p) => p.id === activeId);
    if (!activeProduct || activeProduct.category_id === targetCategoryId) return;

    // Optimistically update category_id so the SortableContext re-groups
    setProducts((prev) =>
      prev.map((p) =>
        p.id === activeId ? { ...p, category_id: targetCategoryId as string | null } : p
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const origCatId = originalCategoryIdRef.current;

    setActiveDrag(null);
    originalCategoryIdRef.current = null;

    if (!over) return;

    const activeType = active.data.current?.type as string | undefined;
    const activeId = active.id as string;
    const overId = over.id as string;

    // ── Category reorder ───────────────────────────────────────────
    if (activeType === 'category') {
      if (activeId === overId) return;
      const oldIdx = categories.findIndex((c) => c.id === activeId);
      const newIdx = categories.findIndex((c) => c.id === overId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(categories, oldIdx, newIdx).map((c, i) => ({
        ...c,
        sort_order: i,
      }));
      setCategories(reordered);
      void persistCategoryOrder(reordered);
      return;
    }

    // ── Dish reorder / cross-category move ─────────────────────────
    if (activeType !== 'dish') return;

    // onDragOver already updated category_id for cross-category moves.
    // Now finalize position within the target category and persist.
    let dishesToPersist: Product[] = [];

    setProducts((prev) => {
      const activeProduct = prev.find((p) => p.id === activeId);
      if (!activeProduct) return prev;

      const targetCatId = activeProduct.category_id ?? null;

      // Dishes currently in the target category, in display order
      let targetDishes = prev.filter((p) => p.category_id === targetCatId);

      // Reorder within category if dropped on another dish in the same category
      if (over.data.current?.type === 'dish' && activeId !== overId) {
        const overProduct = prev.find((p) => p.id === overId);
        if (overProduct && overProduct.category_id === targetCatId) {
          const oldIdx = targetDishes.findIndex((p) => p.id === activeId);
          const newIdx = targetDishes.findIndex((p) => p.id === overId);
          if (oldIdx !== -1 && newIdx !== -1) {
            targetDishes = arrayMove(targetDishes, oldIdx, newIdx);
          }
        }
      }

      // Assign sort_order = position index within target category
      const updatedTargetDishes = targetDishes.map((p, i) => ({ ...p, sort_order: i }));

      // If cross-category, also reassign sort_orders for the old category
      const crossCategory = origCatId !== targetCatId;
      const oldCatDishes = crossCategory
        ? prev
            .filter((p) => p.category_id === origCatId)
            .map((p, i) => ({ ...p, sort_order: i }))
        : [];

      dishesToPersist = [...updatedTargetDishes, ...oldCatDishes];

      // Rebuild flat products array
      const others = prev.filter(
        (p) =>
          p.category_id !== targetCatId &&
          (!crossCategory || p.category_id !== origCatId)
      );
      return [...others, ...updatedTargetDishes, ...oldCatDishes];
    });

    void persistDishChanges(dishesToPersist);
  }

  // ── Derived ────────────────────────────────────────────────────────
  const categorisedProducts = categories.map((cat) => ({
    category: cat,
    products: products
      .filter((p) => p.category_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
  const uncategorised = products
    .filter((p) => !p.category_id)
    .sort((a, b) => a.sort_order - b.sort_order);

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
            <Link href="/dashboard/menu/addons">
              <Plus className="w-4 h-4 mr-2" />
              Add-ons
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/scan">
              <Scan className="w-4 h-4 mr-2" />
              AI Scanner
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
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

      {/* DndContext wraps the whole list so category and dish drags share one context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {/* SortableContext for categories only (not uncategorised) */}
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
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
          </SortableContext>

          {/* Uncategorised — always at the bottom, not category-sortable */}
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
              onDeleteAll={() => deleteAllUncategorised()}
              onAddDish={() => openAddDish('')}
              onEditDish={openEditDish}
              onDeleteDish={deleteDish}
              onToggleAvailability={toggleAvailability}
            />
          )}
        </div>

        {/* Drag overlays */}
        <DragOverlay>
          {activeDrag?.type === 'category' && (
            <div className="bg-white border rounded-xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-semibold opacity-95 pointer-events-none">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {activeDrag.item.name}
            </div>
          )}
          {activeDrag?.type === 'dish' && (
            <div className="bg-white border rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm font-medium opacity-95 pointer-events-none">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{activeDrag.item.name}</span>
              <span className="text-muted-foreground text-xs flex-shrink-0 ml-auto">
                {formatPrice(activeDrag.item.price)}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
  onDeleteAll?: () => void;
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
  onDeleteAll,
  onAddDish,
  onEditDish,
  onDeleteDish,
  onToggleAvailability,
}: CategorySectionProps) {
  const isUncategorised = !category;
  const sectionId = category?.id ?? '__uncategorised__';

  // useSortable for the whole category section (category reorder).
  // Disabled for uncategorised so it can't be dragged as a category.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sectionId,
    data: { type: 'category' },
    disabled: isUncategorised,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('border rounded-xl overflow-hidden', isDragging && 'opacity-40 shadow-lg')}
    >
      {/* Category header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {/* Category drag handle — only shown for real categories */}
          {!isUncategorised && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0 p-0.5"
              tabIndex={-1}
              title="Drag to reorder category"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}

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
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isUncategorised && onDeleteAll && products.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={onDeleteAll}
              title="Delete all uncategorised dishes"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete All
            </Button>
          )}
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
            <SortableContext
              items={products.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
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
            </SortableContext>
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: product.id,
    data: { type: 'dish', categoryId: product.category_id ?? null },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors',
        !product.is_available && 'opacity-60',
        isDragging && 'opacity-30 bg-gray-50',
      )}
    >
      {/* Dish drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        tabIndex={-1}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Thumbnail */}
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cdnImg(product.image_url)!}
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
