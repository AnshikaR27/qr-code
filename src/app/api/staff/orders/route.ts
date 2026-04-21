import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { createOrder } from '@/lib/order-helpers';
import { logActivity } from '@/lib/activity-logger';
import { placeOrderSchema } from '@/lib/validators';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  if (parsed.data.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Restaurant mismatch' }, { status: 403 });
  }

  try {
    const result = await createOrder({
      ...parsed.data,
      placed_by_staff_id: session.staff_id,
    });

    logActivity({
      restaurant_id: session.restaurant_id,
      actor_type: 'staff',
      actor_id: session.staff_id,
      actor_name: `${session.name} (${session.role})`,
      action: 'order.placed',
      entity_type: 'order',
      entity_id: result.orderId,
      metadata: { order_number: result.orderNumber, table_id: parsed.data.table_id },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
