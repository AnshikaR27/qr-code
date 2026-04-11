import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import KitchenDashboard from './KitchenDashboard';
import type { Restaurant } from '@/types';

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

  return (
    <KitchenDashboard
      restaurant={restaurant as Restaurant}
      initialOrders={[]}
    />
  );
}
