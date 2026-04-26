import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';
import PrinterSettings from '@/components/dashboard/PrinterSettings';
import type { Category, Restaurant } from '@/types';

export default async function StaffSettingsPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  if (!hasPermission(session.role, 'settings:edit_printer')) {
    redirect('/staff-dashboard');
  }

  const admin = getSupabaseAdmin();
  const [{ data: restaurant }, { data: categories }] = await Promise.all([
    admin
      .from('restaurants')
      .select('*')
      .eq('id', session.restaurant_id)
      .single(),
    admin
      .from('categories')
      .select('id, name, name_hindi, sort_order, restaurant_id')
      .eq('restaurant_id', session.restaurant_id)
      .order('sort_order', { ascending: true }),
  ]);

  if (!restaurant) redirect('/staff/login');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Printer configuration
        </p>
      </div>
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Printers
        </h2>
        <PrinterSettings restaurant={restaurant as Restaurant} categories={(categories ?? []) as Category[]} />
      </div>
    </div>
  );
}
