import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
import GlobalNotifications from '@/components/dashboard/GlobalNotifications';
import { AutoPrintListener } from '@/components/dashboard/AutoPrintListener';
import type { Restaurant } from '@/types';

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Persists across all dashboard tab navigations */}
      <AutoPrintListener
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        printerConfig={restaurant.printer_config}
      />
      <Sidebar restaurant={restaurant as Restaurant} />
      <main className="flex-1 overflow-auto">
        <GlobalNotifications restaurantId={restaurant.id} restaurantName={restaurant.name} printerConfig={restaurant.printer_config} />
        {children}
      </main>
    </div>
  );
}
