'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, GripVertical, ChevronDown, ChevronRight,
  CheckSquare, Circle, X, Loader2, ToggleLeft, ToggleRight,
  Layers, Tag, Leaf,
} from 'lucide-react';
import {
  DndContext, DragEndEvent, PointerSensor, closestCenter,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { AddonGroup, AddonItem, Category, Product, Restaurant } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageData {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  groups: AddonGroup[];
}

// ─── Quick presets ────────────────────────────────────────────────────────────

const QUICK_PRESETS = [
  {
    label: 'Size (S/M/L)',
    group: { name: 'Choose Size', selection_type: 'radio' as const, is_required: true, max_selections: null },
    items: [
      { name: 'Regular', price: 0, is_veg: true },
      { name: 'Medium',  price: 20, is_veg: true },
      { name: 'Large',   price: 40, is_veg: true },
    ],
  },
  {
    label: 'Extra Cheese',
    group: { name: 'Add-ons', selection_type: 'checkbox' as const, is_required: false, max_selections: null },
    items: [
      { name: 'Extra Cheese', price: 30, is_veg: true },
    ],
  },
  {
    label: 'Sauce Choice',
    group: { name: 'Choose Sauce', selection_type: 'radio' as const, is_required: false, max_selections: null },
    items: [
      { name: 'Ketchup',  price: 0, is_veg: true },
      { name: 'Mustard',  price: 0, is_veg: true },
      { name: 'Schezwan', price: 10, is_veg: true },
      { name: 'Mayo',     price: 10, is_veg: true },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddonsPage() {
  const [data, setData]       = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  // Group form state
  const [groupFormOpen, setGroupFormOpen]   = useState(false);
  const [editingGroup, setEditingGroup]     = useState<AddonGroup | null>(null);
  const [groupName, setGroupName]           = useState('');
  const [selectionType, setSelectionType]   = useState<'checkbox' | 'radio'>('checkbox');
  const [isRequired, setIsRequired]         = useState(false);
  const [maxSelections, setMaxSelections]   = useState<string>('');
  const [savingGroup, setSavingGroup]       = useState(false);

  // Item form state (per-group inline)
  const [itemForms, setItemForms]           = useState<Record<string, { open: boolean; editing: AddonItem | null; name: string; price: string; isVeg: boolean }>>({});

  // Assignment sheet state
  const [assignGroup, setAssignGroup]       = useState<AddonGroup | null>(null);
  const [assignTab, setAssignTab]           = useState<'products' | 'categories'>('products');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [assignedProducts, setAssignedProducts]     = useState<Set<string>>(new Set());
  const [assignedCategories, setAssignedCategories] = useState<Set<string>>(new Set());
  const [savingAssign, setSavingAssign]     = useState(false);

  // Collapsed groups
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: restaurant } = await supabase
      .from('restaurants').select('*').eq('owner_id', user.id).single();
    if (!restaurant) { setLoading(false); return; }

    const [
      { data: categories },
      { data: products },
      { data: groups },
      { data: groupItems },
    ] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
      supabase.from('products').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
      supabase.from('addon_groups').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
      supabase.from('addon_items').select('*').order('sort_order'),
    ]);

    // Attach items to groups
    const fullGroups: AddonGroup[] = (groups ?? []).map((g) => ({
      ...g,
      items: (groupItems ?? []).filter((i) => i.addon_group_id === g.id),
    }));

    setData({
      restaurant: restaurant as Restaurant,
      categories: (categories ?? []) as Category[],
      products:   (products ?? [])   as Product[],
      groups: fullGroups,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Group CRUD ──────────────────────────────────────────────────────────────

  function openNewGroup(preset?: typeof QUICK_PRESETS[0]) {
    setEditingGroup(null);
    if (preset) {
      setGroupName(preset.group.name);
      setSelectionType(preset.group.selection_type);
      setIsRequired(preset.group.is_required);
      setMaxSelections(preset.group.max_selections !== null ? String(preset.group.max_selections) : '');
    } else {
      setGroupName('');
      setSelectionType('checkbox');
      setIsRequired(false);
      setMaxSelections('');
    }
    setGroupFormOpen(true);
  }

  function openEditGroup(group: AddonGroup) {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectionType(group.selection_type);
    setIsRequired(group.is_required);
    setMaxSelections(group.max_selections !== null ? String(group.max_selections) : '');
    setGroupFormOpen(true);
  }

  async function saveGroup() {
    if (!groupName.trim() || !data) return;
    setSavingGroup(true);
    const supabase = createClient();
    try {
      const payload = {
        restaurant_id: data.restaurant.id,
        name: groupName.trim(),
        selection_type: selectionType,
        is_required: isRequired,
        max_selections: selectionType === 'radio' ? null : (maxSelections ? parseInt(maxSelections, 10) : null),
        sort_order: editingGroup?.sort_order ?? (data.groups.length),
      };

      if (editingGroup) {
        const { error } = await supabase.from('addon_groups').update(payload).eq('id', editingGroup.id);
        if (error) throw error;
        toast.success('Group updated');
      } else {
        const { error } = await supabase.from('addon_groups').insert(payload);
        if (error) throw error;
        toast.success('Group created');
      }
      setGroupFormOpen(false);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingGroup(false);
    }
  }

  async function deleteGroup(group: AddonGroup) {
    if (!confirm(`Delete "${group.name}" and all its items?`)) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from('addon_groups').delete().eq('id', group.id);
      if (error) throw error;
      toast.success('Group deleted');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  // ── Item CRUD ───────────────────────────────────────────────────────────────

  function openItemForm(groupId: string, editing?: AddonItem) {
    setItemForms((prev) => ({
      ...prev,
      [groupId]: {
        open: true,
        editing: editing ?? null,
        name: editing?.name ?? '',
        price: editing ? String(editing.price) : '0',
        isVeg: editing?.is_veg ?? true,
      },
    }));
  }

  function closeItemForm(groupId: string) {
    setItemForms((prev) => ({ ...prev, [groupId]: { open: false, editing: null, name: '', price: '0', isVeg: true } }));
  }

  async function saveItem(groupId: string) {
    const form = itemForms[groupId];
    if (!form || !form.name.trim()) return;
    const supabase = createClient();
    try {
      const group = data?.groups.find((g) => g.id === groupId);
      const sortOrder = form.editing?.sort_order ?? (group?.items.length ?? 0);
      const payload = {
        addon_group_id: groupId,
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        is_veg: form.isVeg,
        is_available: true,
        sort_order: sortOrder,
      };
      if (form.editing) {
        const { error } = await supabase.from('addon_items').update(payload).eq('id', form.editing.id);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase.from('addon_items').insert(payload);
        if (error) throw error;
        toast.success('Item added');
      }
      closeItemForm(groupId);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save item');
    }
  }

  async function deleteItem(item: AddonItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from('addon_items').delete().eq('id', item.id);
      if (error) throw error;
      toast.success('Item deleted');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item');
    }
  }

  async function toggleItemAvailability(item: AddonItem) {
    const supabase = createClient();
    const { error } = await supabase.from('addon_items').update({ is_available: !item.is_available }).eq('id', item.id);
    if (error) { toast.error('Failed to update'); return; }
    await loadData();
  }

  // ── Drag reorder (groups) ───────────────────────────────────────────────────

  async function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const oldIdx = data.groups.findIndex((g) => g.id === active.id);
    const newIdx = data.groups.findIndex((g) => g.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(data.groups, oldIdx, newIdx).map((g, i) => ({ ...g, sort_order: i }));
    setData((prev) => prev ? { ...prev, groups: reordered } : prev);
    const supabase = createClient();
    await Promise.all(reordered.map((g) => supabase.from('addon_groups').update({ sort_order: g.sort_order }).eq('id', g.id)));
  }

  async function handleItemDragEnd(event: DragEndEvent, groupId: string) {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const group = data.groups.find((g) => g.id === groupId);
    if (!group) return;
    const oldIdx = group.items.findIndex((i) => i.id === active.id);
    const newIdx = group.items.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(group.items, oldIdx, newIdx).map((it, i) => ({ ...it, sort_order: i }));
    setData((prev) => prev ? {
      ...prev,
      groups: prev.groups.map((g) => g.id === groupId ? { ...g, items: reordered } : g),
    } : prev);
    const supabase = createClient();
    await Promise.all(reordered.map((it) => supabase.from('addon_items').update({ sort_order: it.sort_order }).eq('id', it.id)));
  }

  // ── Assignment management ───────────────────────────────────────────────────

  async function openAssignSheet(group: AddonGroup) {
    setAssignGroup(group);
    setAssignTab('products');
    const supabase = createClient();
    const [{ data: pLinks }, { data: cLinks }] = await Promise.all([
      supabase.from('product_addon_groups').select('product_id').eq('addon_group_id', group.id),
      supabase.from('category_addon_groups').select('category_id').eq('addon_group_id', group.id),
    ]);
    setAssignedProducts(new Set((pLinks ?? []).map((r) => r.product_id)));
    setAssignedCategories(new Set((cLinks ?? []).map((r) => r.category_id)));
    setSelectedProducts(new Set((pLinks ?? []).map((r) => r.product_id)));
    setSelectedCategories(new Set((cLinks ?? []).map((r) => r.category_id)));
  }

  async function saveAssignments() {
    if (!assignGroup) return;
    setSavingAssign(true);
    const supabase = createClient();
    try {
      // Products — add new links, remove removed ones
      const addProducts    = Array.from(selectedProducts).filter((id) => !assignedProducts.has(id));
      const removeProducts = Array.from(assignedProducts).filter((id) => !selectedProducts.has(id));
      const addCategories  = Array.from(selectedCategories).filter((id) => !assignedCategories.has(id));
      const removeCategories = Array.from(assignedCategories).filter((id) => !selectedCategories.has(id));

      await Promise.all([
        addProducts.length > 0 && supabase.from('product_addon_groups').insert(
          addProducts.map((pid) => ({ product_id: pid, addon_group_id: assignGroup.id }))
        ),
        removeProducts.length > 0 && supabase.from('product_addon_groups')
          .delete().eq('addon_group_id', assignGroup.id).in('product_id', removeProducts),
        addCategories.length > 0 && supabase.from('category_addon_groups').insert(
          addCategories.map((cid) => ({ category_id: cid, addon_group_id: assignGroup.id }))
        ),
        removeCategories.length > 0 && supabase.from('category_addon_groups')
          .delete().eq('addon_group_id', assignGroup.id).in('category_id', removeCategories),
      ]);

      toast.success('Assignments saved');
      setAssignGroup(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSavingAssign(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Could not load restaurant data. Please refresh.</p>
      </div>
    );
  }

  const { groups, categories, products } = data;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" /> Add-ons & Customizations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {groups.length} group{groups.length !== 1 ? 's' : ''} · Zomato-style customization options
          </p>
        </div>
        <Button onClick={() => openNewGroup()}>
          <Plus className="w-4 h-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Quick presets */}
      <div className="mb-6 p-4 border rounded-xl bg-gray-50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Presets</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => (
            <Button key={preset.label} variant="outline" size="sm" onClick={() => openNewGroup(preset)}>
              <Tag className="w-3.5 h-3.5 mr-1.5" />
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Pre-fills the form — you can edit before saving</p>
      </div>

      {/* Group form (create/edit) */}
      {groupFormOpen && (
        <div className="mb-6 border rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">{editingGroup ? 'Edit Group' : 'New Addon Group'}</h2>
            <button onClick={() => setGroupFormOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Group Name *</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder='e.g. "Choose Size", "Add-ons", "Choose Sauce"'
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>

            {/* Selection type */}
            <div>
              <label className="block text-sm font-medium mb-2">Selection Type</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectionType('checkbox')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors',
                    selectionType === 'checkbox' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <CheckSquare className="w-4 h-4" />
                  Checkbox
                  <span className="text-xs font-normal opacity-70">(pick many)</span>
                </button>
                <button
                  onClick={() => setSelectionType('radio')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors',
                    selectionType === 'radio' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Circle className="w-4 h-4" />
                  Radio
                  <span className="text-xs font-normal opacity-70">(pick one)</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              {/* Required toggle */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Required</span>
                <button onClick={() => setIsRequired((v) => !v)} className="text-indigo-600 hover:text-indigo-700">
                  {isRequired ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                </button>
              </div>

              {/* Max selections (checkbox only) */}
              {selectionType === 'checkbox' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Max Selections</label>
                  <input
                    type="number"
                    min="1"
                    value={maxSelections}
                    onChange={(e) => setMaxSelections(e.target.value)}
                    placeholder="Unlimited"
                    className="w-24 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button>
            <Button onClick={saveGroup} disabled={savingGroup || !groupName.trim()}>
              {savingGroup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingGroup ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </div>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-medium text-muted-foreground">No addon groups yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a group like &quot;Choose Size&quot; or &quot;Add-ons&quot;, then assign it to dishes or categories.
          </p>
          <Button className="mt-4" onClick={() => openNewGroup()}>
            <Plus className="w-4 h-4 mr-2" /> Create First Group
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {groups.map((group) => (
                <SortableGroupCard
                  key={group.id}
                  group={group}
                  categories={categories}
                  products={products}
                  collapsed={!!collapsed[group.id]}
                  onToggleCollapse={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  onEdit={() => openEditGroup(group)}
                  onDelete={() => deleteGroup(group)}
                  onAssign={() => openAssignSheet(group)}
                  onAddItem={() => openItemForm(group.id)}
                  onEditItem={(item) => openItemForm(group.id, item)}
                  onDeleteItem={deleteItem}
                  onToggleItemAvailability={toggleItemAvailability}
                  onItemDragEnd={(e) => handleItemDragEnd(e, group.id)}
                  itemForm={itemForms[group.id]}
                  onItemFormChange={(field, value) =>
                    setItemForms((prev) => ({
                      ...prev,
                      [group.id]: { ...prev[group.id], [field]: value },
                    }))
                  }
                  onSaveItem={() => saveItem(group.id)}
                  onCloseItemForm={() => closeItemForm(group.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Assignment sheet overlay */}
      {assignGroup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setAssignGroup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-t-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-semibold">Assign: {assignGroup.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Choose dishes or categories</p>
              </div>
              <button onClick={() => setAssignGroup(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => setAssignTab('products')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  assignTab === 'products' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Specific Dishes ({selectedProducts.size})
              </button>
              <button
                onClick={() => setAssignTab('categories')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  assignTab === 'categories' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Entire Categories ({selectedCategories.size})
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {assignTab === 'products' ? (
                products.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No dishes found</p>
                ) : (
                  <div className="space-y-1">
                    {products.map((p) => {
                      const checked = selectedProducts.has(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedProducts((prev) => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.is_veg ? '#0F8A00' : '#E23744' }}
                          />
                          <span className="flex-1 text-sm">{p.name}</span>
                          <span className="text-xs text-muted-foreground">₹{p.price}</span>
                        </label>
                      );
                    })}
                  </div>
                )
              ) : (
                categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No categories found</p>
                ) : (
                  <div className="space-y-1">
                    {categories.map((cat) => {
                      const checked = selectedCategories.has(cat.id);
                      const count = products.filter((p) => p.category_id === cat.id).length;
                      return (
                        <label key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedCategories((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="flex-1 text-sm font-medium">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">{count} dish{count !== 1 ? 'es' : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t p-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssignGroup(null)}>Cancel</Button>
              <Button onClick={saveAssignments} disabled={savingAssign}>
                {savingAssign ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Assignments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SortableGroupCard ─────────────────────────────────────────────────────────

interface ItemFormState {
  open: boolean;
  editing: AddonItem | null;
  name: string;
  price: string;
  isVeg: boolean;
}

interface SortableGroupCardProps {
  group: AddonGroup;
  categories: Category[];
  products: Product[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onAddItem: () => void;
  onEditItem: (item: AddonItem) => void;
  onDeleteItem: (item: AddonItem) => void;
  onToggleItemAvailability: (item: AddonItem) => void;
  onItemDragEnd: (event: DragEndEvent) => void;
  itemForm?: ItemFormState;
  onItemFormChange: (field: string, value: string | boolean) => void;
  onSaveItem: () => void;
  onCloseItemForm: () => void;
}

function SortableGroupCard({
  group, collapsed, onToggleCollapse, onEdit, onDelete, onAssign, onAddItem,
  onEditItem, onDeleteItem, onToggleItemAvailability, onItemDragEnd,
  itemForm, onItemFormChange, onSaveItem, onCloseItemForm,
}: SortableGroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: 'group' },
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={cn('border rounded-xl overflow-hidden bg-white', isDragging && 'opacity-40 shadow-lg')}>
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none p-0.5 flex-shrink-0"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Collapse toggle + name */}
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={onToggleCollapse}>
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="font-semibold text-sm truncate">{group.name}</span>
        </button>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant={group.is_required ? 'destructive' : 'secondary'} className="text-xs py-0 h-5">
            {group.is_required ? 'Required' : 'Optional'}
          </Badge>
          <Badge variant="outline" className="text-xs py-0 h-5">
            {group.selection_type === 'radio' ? <Circle className="w-2.5 h-2.5 mr-1" /> : <CheckSquare className="w-2.5 h-2.5 mr-1" />}
            {group.selection_type}
          </Badge>
          <Badge variant="secondary" className="text-xs py-0 h-5">{group.items.length} items</Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAssign} title="Assign to dishes/categories">
            <Tag className="w-3 h-3 mr-1" />Assign
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit group">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete group">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div>
          {/* Items list with drag reorder */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
            <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item)}
                    onToggleAvailability={() => onToggleItemAvailability(item)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {/* Inline item form */}
          {itemForm?.open ? (
            <div className="px-4 py-3 border-t bg-gray-50">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {itemForm.editing ? 'Edit Item' : 'Add Item'}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => onItemFormChange('name', e.target.value)}
                  placeholder="Item name (e.g. Extra Cheese)"
                  autoFocus
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-1">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={itemForm.price}
                    onChange={(e) => onItemFormChange('price', e.target.value)}
                    placeholder="0"
                    className="w-20 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <button
                  onClick={() => onItemFormChange('isVeg', !itemForm.isVeg)}
                  className="p-1.5 rounded-md border hover:bg-white transition-colors"
                  title={itemForm.isVeg ? 'Veg' : 'Non-veg'}
                >
                  <Leaf className={cn('w-3.5 h-3.5', itemForm.isVeg ? 'text-green-600' : 'text-red-500')} />
                </button>
                <Button size="sm" className="h-8" onClick={onSaveItem} disabled={!itemForm.name.trim()}>
                  {itemForm.editing ? 'Update' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={onCloseItemForm}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onAddItem}>
                <Plus className="w-3 h-3 mr-1" /> Add Item
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SortableItemRow ───────────────────────────────────────────────────────────

interface SortableItemRowProps {
  item: AddonItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}

function SortableItemRow({ item, onEdit, onDelete, onToggleAvailability }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors', !item.is_available && 'opacity-55', isDragging && 'opacity-30 bg-gray-50')}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Veg dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: item.is_veg ? '#0F8A00' : '#E23744' }}
      />

      {/* Name + price */}
      <span className="flex-1 text-sm">{item.name}</span>
      <span className="text-sm text-muted-foreground shrink-0">
        {item.price > 0 ? `+₹${item.price}` : 'Included'}
      </span>

      {/* Available toggle */}
      <button
        onClick={onToggleAvailability}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
          item.is_available
            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        )}
      >
        {item.is_available ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{item.is_available ? 'Available' : 'Off'}</span>
      </button>

      {/* Edit / delete */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit item">
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete item">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </li>
  );
}
