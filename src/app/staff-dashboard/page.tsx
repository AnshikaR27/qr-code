import { redirect } from 'next/navigation';

export default function StaffDashboardHome() {
  redirect('/staff-dashboard/orders');
}
