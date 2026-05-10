import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TopItemsClient from './TopItemsClient';

export default async function TopItemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

  return <TopItemsClient />;
}
