import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';
import type { Category, Restaurant } from '@/types';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, name_hindi, sort_order, restaurant_id')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order', { ascending: true });

  return (
    <SettingsClient
      restaurant={restaurant as Restaurant}
      categories={(categories ?? []) as Category[]}
    />
  );
}
