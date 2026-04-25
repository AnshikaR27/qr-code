import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';
import { hasPermission } from '@/lib/staff-permissions';
import type { OrderStatus } from '@/types';
import type { Permission } from '@/lib/staff-permissions';

const STATUS_PERMISSION: Record<string, Permission> = {
  preparing: 'order:set_preparing',
  ready: 'order:set_ready',
  delivered: 'order:set_delivered',
  cancelled: 'order:cancel',
};

const ALLOWED_STATUSES: OrderStatus[] = ['preparing', 'ready', 'delivered', 'cancelled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { orderId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { status } = body as { status?: string };
  if (!status || !ALLOWED_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json(
      { error: 'Invalid status', allowed: ALLOWED_STATUSES },
      { status: 400 },
    );
  }

  const permission = STATUS_PERMISSION[status];
  if (!hasPermission(session.role, permission)) {
    return NextResponse.json(
      { error: `Role '${session.role}' cannot set status to '${status}'` },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdmin();

  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, restaurant_id, order_number')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updated, error: updateError } = await admin
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*, items:order_items(*), table:tables(*)')
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: `order.status.${status}`,
    entity_type: 'order',
    entity_id: orderId,
    metadata: { order_number: order.order_number, status },
  });

  return NextResponse.json(updated);
}
