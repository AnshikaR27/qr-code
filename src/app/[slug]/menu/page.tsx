import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CustomerMenu from '../CustomerMenu';
import CustomerMenuV2 from '../CustomerMenuV2';
import type { Category, Product, Restaurant } from '@/types';

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
    .select('*, hero_image_url')
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

  if (r.ui_theme === 'sunday') {
    return (
      <CustomerMenuV2
        restaurant={r}
        categories={cats}
        products={prods}
        tableId={tableId}
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
