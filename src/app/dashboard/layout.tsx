import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
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
      <Sidebar restaurant={restaurant as Restaurant} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
