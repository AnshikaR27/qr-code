import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hashPin } from '@/lib/staff-auth';
import { logActivity } from '@/lib/activity-logger';
import { staffCreateSchema, staffUpdateSchema } from '@/lib/validators';

async function getOwnerRestaurant(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  return restaurant ? { userId: user.id, restaurantId: restaurant.id } : null;
}

export async function GET(req: NextRequest) {
  const owner = await getOwnerRestaurant(req);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('staff_members')
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .eq('restaurant_id', owner.restaurantId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const owner = await getOwnerRestaurant(req);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  const { name, pin, role } = parsed.data;
  const hashedPin = await hashPin(pin);

  const { data, error } = await getSupabaseAdmin()
    .from('staff_members')
    .insert({ restaurant_id: owner.restaurantId, name, pin: hashedPin, role })
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A staff member with this PIN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }

  logActivity({
    restaurant_id: owner.restaurantId,
    actor_type: 'owner',
    actor_id: owner.userId,
    actor_name: 'Owner',
    action: 'staff.created',
    entity_type: 'staff',
    entity_id: data.id,
    metadata: { name, role },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const owner = await getOwnerRestaurant(req);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = staffUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  const { id, pin, ...updates } = parsed.data;

  const updateData: Record<string, unknown> = { ...updates };
  if (pin) updateData.pin = await hashPin(pin);

  const { data, error } = await getSupabaseAdmin()
    .from('staff_members')
    .update(updateData)
    .eq('id', id)
    .eq('restaurant_id', owner.restaurantId)
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A staff member with this PIN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }

  logActivity({
    restaurant_id: owner.restaurantId,
    actor_type: 'owner',
    actor_id: owner.userId,
    actor_name: 'Owner',
    action: 'staff.updated',
    entity_type: 'staff',
    entity_id: id,
    metadata: { changes: Object.keys(updates) },
  });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const owner = await getOwnerRestaurant(req);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from('staff_members')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', owner.restaurantId);

  if (error) return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });

  logActivity({
    restaurant_id: owner.restaurantId,
    actor_type: 'owner',
    actor_id: owner.userId,
    actor_name: 'Owner',
    action: 'staff.deleted',
    entity_type: 'staff',
    entity_id: id,
  });

  return NextResponse.json({ success: true });
}
