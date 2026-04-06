import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MenuScanClient from './MenuScanClient';
import type { Category, Restaurant } from '@/types';

export const dynamic = 'force-dynamic';

export default async function MenuScanPage() {
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
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order', { ascending: true });

  return (
    <MenuScanClient
      restaurant={restaurant as Restaurant}
      existingCategories={(categories ?? []) as Category[]}
    />
  );
}
