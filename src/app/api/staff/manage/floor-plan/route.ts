import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';
import { logActivity } from '@/lib/activity-logger';

async function getManagerSession(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return null;
  const session = await verifyStaffToken(token);
  if (!session || !hasPermission(session.role, 'settings:edit_floor_plan')) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const [{ data: restaurant }, { data: tables }] = await Promise.all([
    admin
      .from('restaurants')
      .select('id, floor_plan')
      .eq('id', session.restaurant_id)
      .single(),
    admin
      .from('tables')
      .select('id, table_number, display_name, qr_code_url')
      .eq('restaurant_id', session.restaurant_id)
      .order('table_number'),
  ]);

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ floor_plan: restaurant.floor_plan, tables: tables ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if ('floor_plan' in body) {
    const { error } = await admin
      .from('restaurants')
      .update({ floor_plan: body.floor_plan })
      .eq('id', session.restaurant_id);

    if (error) return NextResponse.json({ error: 'Failed to save floor plan' }, { status: 500 });
  }

  if (Array.isArray(body.tables)) {
    const rows = (body.tables as Array<Record<string, unknown>>).map(t => ({
      id: t.id as string,
      restaurant_id: session.restaurant_id,
      table_number: t.table_number as number,
      display_name: (t.display_name as string) ?? null,
    }));

    if (rows.length > 0) {
      const { error } = await admin.from('tables').upsert(rows, { onConflict: 'id' });
      if (error) return NextResponse.json({ error: 'Failed to save tables' }, { status: 500 });
    }
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'floor_plan.updated',
    entity_type: 'restaurant',
    entity_id: session.restaurant_id,
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tableNumber = typeof body.table_number === 'number' ? body.table_number : null;
  if (!tableNumber || tableNumber < 1) {
    return NextResponse.json({ error: 'Valid table_number is required' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tables')
    .insert({
      restaurant_id: session.restaurant_id,
      table_number: tableNumber,
      display_name: typeof body.display_name === 'string' ? body.display_name : null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Table #${tableNumber} already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add table' }, { status: 500 });
  }

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'table.created',
    entity_type: 'table',
    entity_id: data.id,
    metadata: { table_number: tableNumber },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('tables')
    .select('id, table_number, restaurant_id')
    .eq('id', id)
    .eq('restaurant_id', session.restaurant_id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

  const { error } = await admin.from('tables').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'table.deleted',
    entity_type: 'table',
    entity_id: id,
    metadata: { table_number: existing.table_number },
  });

  return NextResponse.json({ success: true });
}
