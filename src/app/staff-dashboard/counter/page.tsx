import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { hasPermission } from '@/lib/staff-permissions';
import CounterDashboard from './CounterDashboard';

export default async function CounterPage() {
  const session = await getStaffSession();
  if (!session) redirect('/staff/login');
  if (!hasPermission(session.role, 'order:record_payment')) {
    redirect('/staff-dashboard');
  }
  return <CounterDashboard />;
}
