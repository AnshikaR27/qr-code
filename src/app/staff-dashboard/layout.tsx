import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import StaffSidebar from '@/components/dashboard/StaffSidebar';
import InstallAppBanner from '@/components/dashboard/InstallAppBanner';
import { StaffProvider } from '@/contexts/StaffContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import type { Metadata } from 'next';
import type { Order, Restaurant } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  const session = await getStaffSession();
  const slug = session?.restaurant_slug;

  let name = 'Staff Dashboard';
  let hasLogo = false;

  if (session) {
    const admin = getSupabaseAdmin();
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('name, logo_url')
      .eq('id', session.restaurant_id)
      .single();
    if (restaurant?.name) name = restaurant.name;
    hasLogo = !!restaurant?.logo_url;
  }

  return {
    manifest: slug ? `/api/manifest/${slug}?staff=1` : '/api/staff/manifest',
    themeColor: '#09090b',
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
      'apple-mobile-web-app-status-bar-style': 'default',
      'mobile-web-app-capable': 'yes',
    },
    icons:
      slug && hasLogo
        ? {
            apple: [{ url: `/api/cafe-icon/${slug}?size=180&v=2`, sizes: '180x180' }],
            icon: [
              { url: `/api/cafe-icon/${slug}?size=192&v=2`, sizes: '192x192', type: 'image/png' },
              { url: `/api/cafe-icon/${slug}?size=512&v=2`, sizes: '512x512', type: 'image/png' },
            ],
          }
        : { icon: [{ url: '/favicon.ico' }] },
  };
}

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
