import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MenuManager from './MenuManager';
import type { Category, Product, Restaurant } from '@/types';

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

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

  return (
    <MenuManager
      restaurant={restaurant as Restaurant}
      initialCategories={(categories ?? []) as Category[]}
      initialProducts={(products ?? []) as Product[]}
    />
  );
}
