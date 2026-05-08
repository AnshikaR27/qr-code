import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';

export default async function StaffDashboardHome() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');

  switch (session.role) {
    case 'manager':
    case 'counter':
      redirect('/staff-dashboard/counter');
    case 'kitchen':
      redirect('/staff-dashboard/kitchen');
    case 'floor':
    default:
      redirect('/staff-dashboard/orders');
  }
}
