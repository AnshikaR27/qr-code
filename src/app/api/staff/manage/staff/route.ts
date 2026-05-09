import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken, hashPin } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';
import { logActivity } from '@/lib/activity-logger';

async function getManagerSession(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return null;
  const session = await verifyStaffToken(token);
  if (!session || !hasPermission(session.role, 'staff:manage')) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('staff_members')
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .eq('restaurant_id', session.restaurant_id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const role = typeof body.role === 'string' ? body.role : '';

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  if (!pin || pin.length < 4 || pin.length > 6) {
    return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 422 });
  }
  if (!['floor', 'kitchen', 'counter'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Managers can only create floor, kitchen, or counter staff.' }, { status: 403 });
  }

  const hashedPin = await hashPin(pin);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('staff_members')
    .insert({ restaurant_id: session.restaurant_id, name, pin: hashedPin, role })
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A staff member with this PIN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'staff.created',
    entity_type: 'staff',
    entity_id: data.id,
    metadata: { name, role },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('staff_members')
    .select('id, restaurant_id, role, name')
    .eq('id', id)
    .eq('restaurant_id', session.restaurant_id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

  if (existing.role === 'manager') {
    return NextResponse.json({ error: 'Cannot edit manager accounts' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.role === 'string') {
    if (body.role === 'manager') {
      return NextResponse.json({ error: 'Cannot promote to manager. Only the owner can create manager accounts.' }, { status: 403 });
    }
    if (['floor', 'kitchen', 'counter'].includes(body.role)) updates.role = body.role;
  }
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.pin === 'string' && body.pin.length >= 4) {
    updates.pin = await hashPin(body.pin);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
  }

  const { data, error } = await admin
    .from('staff_members')
    .update(updates)
    .eq('id', id)
    .select('id, restaurant_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A staff member with this PIN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'staff.updated',
    entity_type: 'staff',
    entity_id: id,
    metadata: { changes: Object.keys(updates).filter(k => k !== 'pin') },
  });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (id === session.staff_id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('staff_members')
    .select('id, restaurant_id, role, name')
    .eq('id', id)
    .eq('restaurant_id', session.restaurant_id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

  if (existing.role === 'manager') {
    return NextResponse.json({ error: 'Cannot delete manager accounts. Only the owner can manage managers.' }, { status: 403 });
  }

  const { error } = await admin.from('staff_members').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'staff.deleted',
    entity_type: 'staff',
    entity_id: id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
