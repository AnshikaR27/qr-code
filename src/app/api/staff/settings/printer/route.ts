import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';
import { hasPermission } from '@/lib/staff-permissions';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'settings:edit_printer')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('restaurants')
    .select('printer_config')
    .eq('id', session.restaurant_id)
    .single();

  if (error) return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  return NextResponse.json(data.printer_config);
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'settings:edit_printer')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid printer config' }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('restaurants')
    .update({ printer_config: body })
    .eq('id', session.restaurant_id);

  if (error) return NextResponse.json({ error: 'Failed to update printer settings' }, { status: 500 });

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (${session.role})`,
    action: 'settings.printer_updated',
    entity_type: 'restaurant',
    entity_id: session.restaurant_id,
  });

  return NextResponse.json({ success: true });
}
