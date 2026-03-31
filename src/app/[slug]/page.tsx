import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import type { Category, Product, Restaurant } from '@/types';

// ssr: false guarantees the menu never renders on the server.
// The splash is the very first thing the customer sees — no hydration flash.
const CustomerMenu = dynamic(() => import('./CustomerMenu'), {
  ssr: false,
  loading: () => <div style={{ minHeight: '100vh' }} />,
});

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function PublicMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId = null } = await searchParams;

  const supabase = await createClient();

  // Fetch restaurant by slug
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!restaurant) notFound();

  // Fetch categories + all products in parallel
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

  // Extract bg so the loading shell matches the restaurant's theme color
  const bgColor = ((restaurant.design_tokens as Record<string, string> | null)?.['--bg'] ?? '#FFF8F0').trim();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bgColor }}>
      <CustomerMenu
        restaurant={restaurant as Restaurant}
        categories={(categories ?? []) as Category[]}
        products={(products ?? []) as Product[]}
        tableId={tableId}
      />
    </div>
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
