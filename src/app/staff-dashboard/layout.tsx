import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import StaffSidebar from '@/components/dashboard/StaffSidebar';
import InstallAppBanner from '@/components/dashboard/InstallAppBanner';
import { StaffProvider } from '@/contexts/StaffContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import type { Order, Restaurant } from '@/types';

export default async function StaffDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  const admin = getSupabaseAdmin();

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('*')
    .eq('id', session.restaurant_id)
    .single();

  if (!restaurant) redirect('/staff/login');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: orders } = await admin
    .from('orders')
    .select('*, items:order_items(*), table:tables(*)')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StaffProvider staff={session} restaurant={restaurant as Restaurant}>
        <StaffSidebar staff={session} restaurant={restaurant as Restaurant} />
        <main className="flex-1 overflow-auto">
          <InstallAppBanner />
          <OrdersProvider restaurantId={restaurant.id} initialOrders={(orders ?? []) as Order[]}>
            {children}
          </OrdersProvider>
        </main>
      </StaffProvider>
    </div>
  );
}
