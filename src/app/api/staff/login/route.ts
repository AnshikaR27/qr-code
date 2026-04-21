import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyPin, createStaffToken, getStaffCookieName } from '@/lib/staff-auth';
import { logActivity } from '@/lib/activity-logger';
import { staffLoginSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 422 });
  }

  const { restaurant_slug, pin } = parsed.data;
  const admin = getSupabaseAdmin();

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', restaurant_slug)
    .eq('is_active', true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const { data: staffList } = await admin
    .from('staff_members')
    .select('id, name, pin, role')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true);

  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  let matchedStaff: typeof staffList[0] | null = null;
  for (const s of staffList) {
    if (await verifyPin(pin, s.pin)) {
      matchedStaff = s;
      break;
    }
  }

  if (!matchedStaff) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  const token = await createStaffToken({
    staff_id: matchedStaff.id,
    restaurant_id: restaurant.id,
    restaurant_slug: restaurant.slug,
    name: matchedStaff.name,
    role: matchedStaff.role as 'waiter' | 'kitchen',
  });

  logActivity({
    restaurant_id: restaurant.id,
    actor_type: 'staff',
    actor_id: matchedStaff.id,
    actor_name: `${matchedStaff.name} (${matchedStaff.role})`,
    action: 'staff.login',
  });

  const response = NextResponse.json({
    staff: { id: matchedStaff.id, name: matchedStaff.name, role: matchedStaff.role },
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
  });

  response.cookies.set(getStaffCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });

  return response;
}
