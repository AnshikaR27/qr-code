import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import CustomerMenu from '../CustomerMenu';
import CustomerMenuV2 from '../CustomerMenuV2';
import type { AddonGroup, Category, Product, Restaurant } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

// Cached per-request so generateMetadata and the page share one query
const getRestaurant = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url, hero_image_url, tagline, address, city, design_tokens, ui_theme')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return data as Restaurant | null;
});

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId = null } = await searchParams;
  const supabase = await createClient();

  // Stage 1: restaurant + categories + products in parallel
  // Categories/products filter through an inner join on restaurants.slug
  // so they don't need restaurant.id upfront.
  const [restaurant, { data: rawCategories }, { data: rawProducts }] = await Promise.all([
    getRestaurant(slug),
    supabase
      .from('categories')
      .select('id, name, name_hindi, sort_order, parent_category_id, restaurants!inner(id)')
      .eq('restaurants.slug', slug)
      .eq('restaurants.is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, name_hindi, description, price, image_url, is_veg, is_jain, spice_level, allergens, dietary_tags, is_available, sort_order, order_count, category_id, restaurants!inner(id)')
      .eq('restaurants.slug', slug)
      .eq('restaurants.is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (!restaurant) notFound();

  const r = restaurant as Restaurant;
  const cats = ((rawCategories ?? []) as any[]).map(({ restaurants: _, ...rest }) => rest) as Category[];
  const prods = ((rawProducts ?? []) as any[]).map(({ restaurants: _, ...rest }) => rest) as Product[];

  // Stage 2: addon groups with nested items (single query stage)
  const addonGroupMap = await fetchAddonGroupMap(prods, cats);

  if (r.ui_theme === 'sunday') {
    return (
      <CustomerMenuV2
        restaurant={r}
        categories={cats}
        products={prods}
        tableId={tableId}
        addonGroupMap={addonGroupMap}
      />
    );
  }

  return (
    <CustomerMenu
      restaurant={r}
      categories={cats}
      products={prods}
      tableId={tableId}
    />
  );
}

async function fetchAddonGroupMap(
  prods: Product[],
  cats: Category[],
): Promise<Record<string, AddonGroup[]>> {
  if (prods.length === 0) return {};

  const admin = getSupabaseAdmin();
  const productIds = prods.map((p) => p.id);
  const catIds = cats.map((c) => c.id);

  // Single stage: fetch links with nested addon groups and their items
  const [{ data: productLinks }, { data: catLinks }] = await Promise.all([
    admin
      .from('product_addon_groups')
      .select('product_id, addon_group:addon_groups(id, name, selection_type, is_required, max_selections, sort_order, items:addon_items(id, addon_group_id, name, price, is_veg, is_available, sort_order))')
      .in('product_id', productIds),
    catIds.length > 0
      ? admin
          .from('category_addon_groups')
          .select('category_id, addon_group:addon_groups(id, name, selection_type, is_required, max_selections, sort_order, items:addon_items(id, addon_group_id, name, price, is_veg, is_available, sort_order))')
          .in('category_id', catIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const map: Record<string, AddonGroup[]> = {};
  for (const prod of prods) {
    const seen = new Set<string>();
    const groups: AddonGroup[] = [];

    for (const link of (productLinks ?? []) as any[]) {
      if (link.product_id === prod.id && link.addon_group && !seen.has(link.addon_group.id)) {
        seen.add(link.addon_group.id);
        groups.push(link.addon_group);
      }
    }

    for (const link of (catLinks ?? []) as any[]) {
      if (link.category_id === prod.category_id && link.addon_group && !seen.has(link.addon_group.id)) {
        seen.add(link.addon_group.id);
        groups.push(link.addon_group);
      }
    }

    if (groups.length > 0) {
      groups.sort((a, b) => a.sort_order - b.sort_order);
      for (const g of groups) {
        if (g.items) g.items.sort((a, b) => a.sort_order - b.sort_order);
      }
      map[prod.id] = groups;
    }
  }

  return map;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);

  if (!restaurant) return { title: 'Menu' };

  return {
    title: `${restaurant.name} — Menu`,
    description: restaurant.city
      ? `Order from ${restaurant.name}, ${restaurant.city}`
      : `Order from ${restaurant.name}`,
  };
}
