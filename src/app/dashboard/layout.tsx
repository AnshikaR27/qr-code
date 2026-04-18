import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
import GlobalNotifications from '@/components/dashboard/GlobalNotifications';
import { AutoPrintListener } from '@/components/dashboard/AutoPrintListener';
import { OrdersProvider } from '@/contexts/OrdersContext';
import SentryInit from '@/components/SentryInit';
import type { Order, Restaurant } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch restaurant for this owner
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (error || !restaurant) {
    // User has an account but no restaurant row — shouldn't happen normally
    redirect('/register');
  }

  // Fetch today's orders so the realtime context starts with fresh data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: orders } = await supabase
    .from('orders')
    .select('*, items:order_items(*), table:tables(*)')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SentryInit />
      {/* Persists across all dashboard tab navigations */}
      <AutoPrintListener
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        printerConfig={restaurant.printer_config}
      />
      <Sidebar restaurant={restaurant as Restaurant} />
      <main className="flex-1 overflow-auto">
        <GlobalNotifications restaurantId={restaurant.id} restaurantName={restaurant.name} printerConfig={restaurant.printer_config} />
        <OrdersProvider restaurantId={restaurant.id} initialOrders={(orders ?? []) as Order[]}>
          {children}
        </OrdersProvider>
      </main>
    </div>
  );
}
