import { cache } from 'react';
import { redirect } from 'next/navigation';
import Script from 'next/script';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import StaffSidebar from '@/components/dashboard/StaffSidebar';
import InstallAppBanner from '@/components/dashboard/InstallAppBanner';
import StaffMobileHeader from '@/components/dashboard/StaffMobileHeader';
import { StaffProvider } from '@/contexts/StaffContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import type { Metadata, Viewport } from 'next';
import type { Restaurant } from '@/types';

const getStaffContext = cache(async () => {
  const session = await getStaffSession();
  if (!session) return { session: null, restaurant: null };

  const admin = getSupabaseAdmin();
  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, name, slug, service_mode, floor_plan')
    .eq('id', session.restaurant_id)
    .single();

  if (error) console.error('[staff-dashboard] restaurant fetch failed:', error.message);

  return { session, restaurant: restaurant as Restaurant | null };
});

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export async function generateMetadata(): Promise<Metadata> {
  const { session, restaurant } = await getStaffContext();
  const slug = session?.restaurant_slug;
  const name = restaurant?.name ?? 'Staff Dashboard';

  return {
    manifest: slug ? `/api/manifest/${slug}?staff=1` : '/api/staff/manifest',
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
      'apple-mobile-web-app-status-bar-style': 'default',
      'mobile-web-app-capable': 'yes',
    },
    icons: slug
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
  const { session, restaurant } = await getStaffContext();
  if (!session) redirect('/staff/login');
  if (!restaurant) redirect('/staff/login');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StaffProvider staff={session} restaurant={restaurant as Restaurant}>
        <StaffSidebar staff={session} restaurant={restaurant as Restaurant} />
        <main className="flex-1 overflow-auto">
          <StaffMobileHeader />
          <InstallAppBanner />
          <OrdersProvider restaurantId={restaurant.id}>
            {children}
          </OrdersProvider>
        </main>
      </StaffProvider>
      <Script id="register-sw" strategy="afterInteractive">
        {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`}
      </Script>
    </div>
  );
}
