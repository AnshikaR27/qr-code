import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';
import { hasPermission } from '@/lib/staff-permissions';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('products')
    .select('*')
    .eq('restaurant_id', session.restaurant_id)
    .order('sort_order');

  if (error) return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'menu:edit_items')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 422 });
  if (typeof body.price !== 'number' || body.price < 0) {
    return NextResponse.json({ error: 'price must be a non-negative number' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('products')
    .insert({
      restaurant_id: session.restaurant_id,
      name,
      name_hindi: body.name_hindi ?? null,
      description: body.description ?? null,
      price: body.price,
      image_url: body.image_url ?? null,
      category_id: body.category_id ?? null,
      is_veg: body.is_veg ?? true,
      is_jain: body.is_jain ?? false,
      spice_level: body.spice_level ?? 0,
      allergens: body.allergens ?? [],
      dietary_tags: body.dietary_tags ?? null,
      is_available: body.is_available ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });

  revalidatePath(`/${session.restaurant_slug}`);

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'item.created',
    entity_type: 'product',
    entity_id: data.id,
    metadata: { name },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'menu:edit_items')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id;
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from('products')
    .select('id, restaurant_id, name')
    .eq('id', id)
    .single();

  if (!existing || existing.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const allowed: (keyof typeof body)[] = [
    'name', 'name_hindi', 'description', 'image_url', 'category_id',
    'is_veg', 'is_jain', 'spice_level', 'allergens', 'dietary_tags',
    'is_available', 'sort_order',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
  }

  const { data, error } = await admin
    .from('products')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });

  revalidatePath(`/${session.restaurant_slug}`);

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'item.updated',
    entity_type: 'product',
    entity_id: id,
    metadata: { name: data.name, fields: Object.keys(updates) },
  });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'menu:edit_items')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from('products')
    .select('id, restaurant_id, name')
    .eq('id', id)
    .single();

  if (!existing || existing.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const { error } = await admin.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });

  revalidatePath(`/${session.restaurant_slug}`);

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'item.deleted',
    entity_type: 'product',
    entity_id: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
