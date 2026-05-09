import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';
import { logActivity } from '@/lib/activity-logger';

async function getManagerSession(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return null;
  const session = await verifyStaffToken(token);
  if (!session || !hasPermission(session.role, 'settings:edit_restaurant')) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, slug, phone, address, city, opening_time, closing_time, logo_url, service_mode, billing_config')
    .eq('id', session.restaurant_id)
    .single();

  if (error) return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = [
    'name', 'phone', 'address', 'city', 'opening_time', 'closing_time',
    'logo_url', 'service_mode', 'billing_config',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === 'billing_config' && typeof body[key] === 'object') {
        const bc = body[key] as Record<string, unknown>;
        const safeKeys = [
          'gstin', 'fssai', 'gst_rate', 'service_charge_enabled',
          'service_charge_percent', 'sac_code', 'legal_name', 'billing_address', 'state',
        ];
        const safeBilling: Record<string, unknown> = {};
        for (const bk of safeKeys) {
          if (bk in bc) safeBilling[bk] = bc[bk];
        }
        updates[key] = safeBilling;
      } else {
        updates[key] = body[key];
      }
    }
  }

  if (typeof updates.name === 'string' && !updates.name.trim()) {
    return NextResponse.json({ error: 'Restaurant name cannot be empty' }, { status: 422 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('restaurants')
    .update(updates)
    .eq('id', session.restaurant_id)
    .select('id, name, slug, phone, address, city, opening_time, closing_time, logo_url, service_mode, billing_config')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });

  logActivity({
    restaurant_id: session.restaurant_id,
    actor_type: 'staff',
    actor_id: session.staff_id,
    actor_name: `${session.name} (manager)`,
    action: 'settings.updated',
    entity_type: 'restaurant',
    entity_id: session.restaurant_id,
    metadata: { fields: Object.keys(updates) },
  });

  return NextResponse.json(data);
}
