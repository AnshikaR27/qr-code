import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { hasPermission } from '@/lib/staff-permissions';

export default async function StaffDashboardHome() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  if (session.role === 'counter') {
    redirect('/staff-dashboard/counter');
  }

  if (hasPermission(session.role, 'order:set_ready')) {
    redirect('/staff-dashboard/kitchen');
  }

  redirect('/staff-dashboard/orders');
}
