import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';

export default async function StaffDashboardHome() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  if (session.role === 'kitchen') {
    redirect('/staff-dashboard/kitchen');
  }

  redirect('/staff-dashboard/orders');
}
