import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import KitchenDashboard from '@/app/dashboard/orders/KitchenDashboard';
import type { Restaurant } from '@/types';

export default async function StaffOrdersPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('*')
    .eq('id', session.restaurant_id)
    .single();

  if (!restaurant) redirect('/staff/login');

  return (
    <KitchenDashboard
      restaurant={restaurant as Restaurant}
      initialOrders={[]}
      staffSession={session}
    />
  );
}
