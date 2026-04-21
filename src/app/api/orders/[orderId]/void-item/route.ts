import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { authenticateStaffOrOwner, getActorInfo } from '@/lib/staff-api';
import { logActivity } from '@/lib/activity-logger';
import { voidItemSchema } from '@/lib/validators';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let auth;
  try {
    auth = await authenticateStaffOrOwner(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = voidItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  const { order_item_id, reason, action, new_quantity } = parsed.data;
  const admin = getSupabaseAdmin();
  const actor = getActorInfo(auth);

  const { data: order } = await admin
    .from('orders')
    .select('id, restaurant_id, status')
    .eq('id', orderId)
    .single();

  if (!order || order.restaurant_id !== actor.restaurant_id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status === 'delivered' || order.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot void items on a completed order' }, { status: 400 });
  }

  const { data: item } = await admin
    .from('order_items')
    .select('id, name, quantity, price, status, selected_addons')
    .eq('id', order_item_id)
    .eq('order_id', orderId)
    .single();

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (item.status === 'voided') {
    return NextResponse.json({ error: 'Item already voided' }, { status: 400 });
  }

  const staffId = auth.type === 'staff' ? auth.session.staff_id : null;
  const now = new Date().toISOString();

  if (action === 'void') {
    const { error } = await admin
      .from('order_items')
      .update({
        status: 'voided',
        void_reason: reason,
        voided_by: staffId,
        voided_at: now,
        original_quantity: item.quantity,
      })
      .eq('id', order_item_id);

    if (error) return NextResponse.json({ error: 'Failed to void item' }, { status: 500 });
  } else {
    const { error } = await admin
      .from('order_items')
      .update({
        quantity: new_quantity!,
        void_reason: reason,
        voided_by: staffId,
        voided_at: now,
        original_quantity: item.quantity,
      })
      .eq('id', order_item_id);

    if (error) return NextResponse.json({ error: 'Failed to reduce quantity' }, { status: 500 });
  }

  // Recalculate order total
  const { data: allItems } = await admin
    .from('order_items')
    .select('price, quantity, status, selected_addons')
    .eq('order_id', orderId);

  if (allItems) {
    const newTotal = allItems
      .filter((i) => i.status !== 'voided')
      .reduce((sum, i) => {
        const addonTotal = ((i.selected_addons as { price: number }[]) ?? [])
          .reduce((s, a) => s + (a.price ?? 0), 0);
        return sum + (i.price + addonTotal) * i.quantity;
      }, 0);

    await admin.from('orders').update({ total: newTotal }).eq('id', orderId);
  }

  logActivity({
    restaurant_id: actor.restaurant_id,
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    action: action === 'void' ? 'item.voided' : 'item.quantity_reduced',
    entity_type: 'order_item',
    entity_id: order_item_id,
    metadata: {
      order_id: orderId,
      item_name: item.name,
      reason,
      action,
      original_quantity: item.quantity,
      ...(action === 'reduce' ? { new_quantity } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
