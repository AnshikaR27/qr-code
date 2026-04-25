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

  if (!hasPermission(session.role, 'order:merge')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: { order_ids: string[]; merge_group_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.order_ids) || body.order_ids.length < 2) {
    return NextResponse.json({ error: 'At least 2 order_ids required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: orders, error: fetchError } = await admin
    .from('orders')
    .select('id, restaurant_id, table_id, merge_group_id, status, payment_method')
    .in('id', body.order_ids);

  if (fetchError || !orders || orders.length !== body.order_ids.length) {
    return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 });
  }

  if (orders.some(o => o.restaurant_id !== session.restaurant_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allEligible = orders.every(
    o => (o.status === 'placed' || o.status === 'ready') && !o.payment_method,
  );
  if (!allEligible) {
    return NextResponse.json({ error: 'All orders must be active and unpaid' }, { status: 400 });
  }

  const existingGroupId = orders.find(o => o.merge_group_id)?.merge_group_id;
  const groupId = body.merge_group_id ?? existingGroupId ?? crypto.randomUUID();

  const { error: updateError } = await admin
    .from('orders')
    .update({ merge_group_id: groupId })
    .in('id', body.order_ids);

  if (updateError) {
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 });
  }

  const tableIds = [...new Set(orders.filter(o => o.table_id).map(o => o.table_id!))];
  if (tableIds.length > 0) {
    await admin
      .from('tables')
      .update({ merge_group_id: groupId, merged_with: tableIds })
      .in('id', tableIds);
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'orders.merged',
    entity_type: 'order',
    entity_id: groupId,
    metadata: { order_ids: body.order_ids, merge_group_id: groupId },
  });

  return NextResponse.json({ success: true, merge_group_id: groupId });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'order:merge')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: { merge_group_id: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.merge_group_id) {
    return NextResponse.json({ error: 'merge_group_id required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: orders } = await admin
    .from('orders')
    .select('id, restaurant_id, table_id')
    .eq('merge_group_id', body.merge_group_id);

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: 'Merge group not found' }, { status: 404 });
  }

  if (orders.some(o => o.restaurant_id !== session.restaurant_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await admin
    .from('orders')
    .update({ merge_group_id: null })
    .in('id', orders.map(o => o.id));

  const tableIds = [...new Set(orders.filter(o => o.table_id).map(o => o.table_id!))];
  if (tableIds.length > 0) {
    await admin
      .from('tables')
      .update({ merge_group_id: null, merged_with: null })
      .in('id', tableIds);
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'orders.unmerged',
    entity_type: 'order',
    entity_id: body.merge_group_id,
    metadata: { order_ids: orders.map(o => o.id), merge_group_id: body.merge_group_id },
  });

  return NextResponse.json({ success: true });
}
