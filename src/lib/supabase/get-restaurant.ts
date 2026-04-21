import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Restaurant } from '@/types';

export const getAuthenticatedRestaurant = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (error || !restaurant) redirect('/register');

  return { supabase, user, restaurant: restaurant as Restaurant };
});
