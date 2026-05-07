import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';
import { hasPermission } from '@/lib/staff-permissions';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'order:comp_refund')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: { order_id: string; type: 'comp' | 'refund'; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.order_id || !['comp', 'refund'].includes(body.type)) {
    return NextResponse.json({ error: 'order_id and type (comp|refund) required' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();

  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, restaurant_id, order_number, status, payment_method, payment_status')
    .eq('id', body.order_id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.type === 'comp') {
    if (order.payment_status !== 'unpaid') {
      return NextResponse.json({ error: 'Order already has a payment recorded' }, { status: 409 });
    }

    // OLD: status: 'delivered', payment_method: 'comp'
    // payment_method is an enum (cash|upi|card) — 'comp' is not a valid value.
    // payment_status now carries the comp/refund semantics.
    const { error } = await admin
      .from('orders')
      .update({
        payment_status: 'comped',
        discount_amount: 100,
        discount_type: 'percentage',
        discount_before_tax: true,
      })
      .eq('id', body.order_id);

    if (error) return NextResponse.json({ error: 'Failed to comp order' }, { status: 500 });
  } else {
    if (order.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Order has no payment to refund' }, { status: 409 });
    }

    // OLD: status: 'cancelled', payment_method: 'refund'
    // Refund on a served order: only change payment_status (food was eaten).
    // Refund on an unserved order: also cancel (stop food prep).
    const updateData: Record<string, unknown> = {
      payment_status: 'refunded',
    };
    if (order.status !== 'served') {
      updateData.status = 'cancelled';
    }

    const { error } = await admin
      .from('orders')
      .update(updateData)
      .eq('id', body.order_id);

    if (error) return NextResponse.json({ error: 'Failed to refund order' }, { status: 500 });
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: `order.${body.type}`,
    entity_type: 'order',
    entity_id: body.order_id,
    metadata: { order_number: order.order_number, reason: body.reason ?? null },
  });

  return NextResponse.json({ success: true });
}
