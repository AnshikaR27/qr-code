import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@/lib/supabase/public';
import CustomerMenuV2 from '../CustomerMenuV2';
import type { AddonGroup, Category, Product, Restaurant } from '@/types';

export const revalidate = 30;
export const dynamicParams = true;

// Returning [] means no paths are pre-built at build time.
// Combined with dynamicParams = true, new slugs are rendered on first request
// and then cached by Vercel CDN for `revalidate` seconds (ISR).
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

// Cached per-request so generateMetadata and the page share one query
const getRestaurant = cache(async (slug: string) => {
  const { data } = await supabasePublic
    .from('restaurants')
    .select('id, name, slug, logo_url, hero_image_url, tagline, address, city, design_tokens, ui_theme')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return data as Restaurant | null;
});

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;

  // Stage 1: restaurant + categories + products in parallel
  const [restaurant, { data: rawCategories }, { data: rawProducts }] = await Promise.all([
    getRestaurant(slug),
    supabasePublic
      .from('categories')
      .select('id, name, name_hindi, sort_order, parent_category_id, restaurants!inner(id)')
      .eq('restaurants.slug', slug)
      .eq('restaurants.is_active', true)
      .order('sort_order', { ascending: true }),
    supabasePublic
      .from('products')
      .select('id, name, name_hindi, description, price, image_url, is_veg, is_jain, allergens, is_available, sort_order, order_count, category_id, restaurants!inner(id)')
      .eq('restaurants.slug', slug)
      .eq('restaurants.is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (!restaurant) notFound();

  const r = restaurant as Restaurant;
  const cats = ((rawCategories ?? []) as any[]).map(({ restaurants: _, ...rest }) => rest) as Category[];
  const prods = ((rawProducts ?? []) as any[]).map(({ restaurants: _, ...rest }) => rest) as Product[];

  // Stage 2: addon groups with nested items
  const addonGroupMap = await fetchAddonGroupMap(prods, cats);

  return (
    <Suspense fallback={null}>
      <CustomerMenuV2
        restaurant={r}
        categories={cats}
        products={prods}
        addonGroupMap={addonGroupMap}
      />
    </Suspense>
  );
}

async function fetchAddonGroupMap(
  prods: Product[],
  cats: Category[],
): Promise<Record<string, AddonGroup[]>> {
  if (prods.length === 0) return {};

  const productIds = prods.map((p) => p.id);
  const catIds = cats.map((c) => c.id);

  const [{ data: productLinks }, { data: catLinks }] = await Promise.all([
    supabasePublic
      .from('product_addon_groups')
      .select('product_id, addon_group:addon_groups(id, name, selection_type, is_required, max_selections, sort_order, items:addon_items(id, name, price, is_veg, is_available, sort_order))')
      .in('product_id', productIds),
    catIds.length > 0
      ? supabasePublic
          .from('category_addon_groups')
          .select('category_id, addon_group:addon_groups(id, name, selection_type, is_required, max_selections, sort_order, items:addon_items(id, name, price, is_veg, is_available, sort_order))')
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
