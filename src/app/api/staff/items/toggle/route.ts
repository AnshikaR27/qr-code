import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  let body: { product_id: string; is_available: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.product_id || typeof body.is_available !== 'boolean') {
    return NextResponse.json({ error: 'product_id and is_available required' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();

  const { data: product } = await admin
    .from('products')
    .select('id, name, restaurant_id')
    .eq('id', body.product_id)
    .single();

  if (!product || product.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { error } = await admin
    .from('products')
    .update({ is_available: body.is_available })
    .eq('id', body.product_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  revalidatePath(`/${session.restaurant_slug}`);

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: body.is_available ? 'item.available' : 'item.unavailable',
    entity_type: 'product',
    entity_id: body.product_id,
    metadata: { product_name: product.name },
  });

  return NextResponse.json({ success: true });
}
