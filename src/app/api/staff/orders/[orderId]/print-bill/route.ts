import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'order:record_payment')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { orderId } = await params;
  const admin = getSupabaseAdmin();

  const { data: order, error } = await admin
    .from('orders')
    .select('id, restaurant_id, order_number')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
