import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';

async function getManagerSession(req: NextRequest) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return null;
  const session = await verifyStaffToken(token);
  if (!session || !hasPermission(session.role, 'activity:view_log')) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getManagerSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const actorType = searchParams.get('actor_type');
  const offset = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('activity_log')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', session.restaurant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorType) query = query.eq('actor_type', actorType);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });

  return NextResponse.json({ entries: data, total: count, page, limit });
}
