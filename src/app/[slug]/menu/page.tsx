import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import CustomerMenu from '../CustomerMenu';
import CustomerMenuV2 from '../CustomerMenuV2';
import type { AddonGroup, AddonItem, Category, Product, Restaurant } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId = null } = await searchParams;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!restaurant) notFound();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true }),
  ]);

  const r = restaurant as Restaurant;
  const cats = (categories ?? []) as Category[];
  const prods = (products ?? []) as Product[];

  // Fetch addon data server-side using the admin client so RLS on addon tables
  // doesn't block anonymous customers from seeing customization options.
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

  const [{ data: productLinks }, { data: catLinks }] = await Promise.all([
    admin.from('product_addon_groups').select('product_id, addon_group_id').in('product_id', productIds),
    catIds.length > 0
      ? admin.from('category_addon_groups').select('category_id, addon_group_id').in('category_id', catIds)
      : Promise.resolve({ data: [] }),
  ]);

  const groupIdSet = new Set<string>();
  for (const l of productLinks ?? []) groupIdSet.add(l.addon_group_id);
  for (const l of catLinks ?? []) groupIdSet.add(l.addon_group_id);
  const groupIds = Array.from(groupIdSet);

  if (groupIds.length === 0) return {};

  const [{ data: groupsData }, { data: itemsData }] = await Promise.all([
    admin.from('addon_groups').select('*').in('id', groupIds).order('sort_order', { ascending: true }),
    admin.from('addon_items').select('*').in('addon_group_id', groupIds).order('sort_order', { ascending: true }),
  ]);

  const allItems = (itemsData ?? []) as AddonItem[];
  const allGroups: AddonGroup[] = ((groupsData ?? []) as Omit<AddonGroup, 'items'>[]).map((g) => ({
    ...g,
    items: allItems.filter((i) => i.addon_group_id === g.id),
  }));

  const map: Record<string, AddonGroup[]> = {};
  for (const prod of prods) {
    const productGroupIds = new Set(
      (productLinks ?? []).filter((l) => l.product_id === prod.id).map((l) => l.addon_group_id),
    );
    const catGroupIds = new Set(
      (catLinks ?? []).filter((l) => l.category_id === prod.category_id).map((l) => l.addon_group_id),
    );
    const combinedIds = new Set([...productGroupIds, ...catGroupIds]);
    if (combinedIds.size > 0) {
      map[prod.id] = allGroups.filter((g) => combinedIds.has(g.id));
    }
  }

  return map;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, city')
    .eq('slug', slug)
    .single();

  if (!restaurant) return { title: 'Menu' };

  return {
    title: `${restaurant.name} — Menu`,
    description: restaurant.city
      ? `Order from ${restaurant.name}, ${restaurant.city}`
      : `Order from ${restaurant.name}`,
  };
}
