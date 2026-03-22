import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import KitchenDashboard from './KitchenDashboard';
import type { Order, Restaurant } from '@/types';

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

  // Fetch today's orders with items + table info
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('*, items:order_items(*), table:tables(*)')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  return (
    <KitchenDashboard
      restaurant={restaurant as Restaurant}
      initialOrders={(orders ?? []) as Order[]}
    />
  );
}
