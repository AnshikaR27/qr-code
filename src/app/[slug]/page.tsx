import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

const getRestaurant = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('restaurants')
    .select('name, slug, city')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return data;
});

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function SplashPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId } = await searchParams;

  const restaurant = await getRestaurant(slug);
  if (!restaurant) notFound();

  permanentRedirect(`/${slug}/menu${tableId ? `?table=${tableId}` : ''}`);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);

  if (!restaurant) return { title: 'Menu' };

  return {
    title: restaurant.city ? `${restaurant.name} · ${restaurant.city}` : restaurant.name,
    description: `Scan to view the menu and order from ${restaurant.name}`,
  };
}
