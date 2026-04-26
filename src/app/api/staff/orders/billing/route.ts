import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';
import { hasPermission } from '@/lib/staff-permissions';

const PAYMENT_METHODS = ['cash', 'upi', 'card'];

export async function POST(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'order:record_payment')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: {
    order_ids: string[];
    payment_method: string;
    payment_methods?: { method: string; amount: number }[] | null;
    discount_amount?: number | null;
    discount_type?: 'flat' | 'percentage' | null;
    discount_before_tax?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
    return NextResponse.json({ error: 'order_ids required' }, { status: 400 });
  }
  if (!body.payment_method || !PAYMENT_METHODS.includes(body.payment_method)) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: orders, error: fetchError } = await admin
    .from('orders')
    .select('id, restaurant_id, order_number, table_id, merge_group_id, status')
    .in('id', body.order_ids);

  if (fetchError || !orders || orders.length !== body.order_ids.length) {
    return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 });
  }

  if (orders.some(o => o.restaurant_id !== session.restaurant_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const notReady = orders.filter(o => o.status !== 'ready');
  if (notReady.length > 0) {
    return NextResponse.json({
      error: 'One or more orders are no longer ready (may have been cancelled or already billed)',
      conflicting_order_ids: notReady.map(o => o.id),
    }, { status: 409 });
  }

  const isMergedBilling = orders.some(o => o.merge_group_id);

  for (const id of body.order_ids) {
    const { error } = await admin
      .from('orders')
      .update({
        status: 'delivered',
        payment_method: body.payment_method,
        payment_methods: body.payment_methods ?? null,
        discount_amount: body.discount_amount ?? null,
        discount_type: body.discount_type ?? null,
        discount_before_tax: body.discount_before_tax ?? false,
        merge_group_id: null,
      })
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
  }

  if (isMergedBilling) {
    const tableIds = [...new Set(orders.filter(o => o.table_id).map(o => o.table_id!))];
    if (tableIds.length > 0) {
      await admin
        .from('tables')
        .update({ merge_group_id: null, merged_with: null })
        .in('id', tableIds);
    }
  }

  for (const id of body.order_ids) {
    admin.from('push_subscriptions').delete().eq('order_id', id).then(() => {});
  }

  for (const order of orders) {
    logActivity({
      restaurant_id: session.restaurant_id,
      actor_type: 'staff',
      actor_id: session.staff_id,
      actor_name: `${session.name} (${session.role})`,
      action: 'order.payment_recorded',
      entity_type: 'order',
      entity_id: order.id,
      metadata: { order_number: order.order_number, payment_method: body.payment_method },
    });
  }

  return NextResponse.json({ success: true, merged: isMergedBilling });
}
