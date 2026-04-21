import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity-logger';

async function getOwnerRestaurant() {
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
  const owner = await getOwnerRestaurant();
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const actorType = searchParams.get('actor_type');
  const action = searchParams.get('action');

  const offset = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('activity_log')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', owner.restaurantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorType) query = query.eq('actor_type', actorType);
  if (action) query = query.like('action', `${action}%`);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });

  return NextResponse.json({ entries: data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const owner = await getOwnerRestaurant();
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, entity_type, entity_id, metadata } = body as {
    action: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
  };

  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

  logActivity({
    restaurant_id: owner.restaurantId,
    actor_type: 'owner',
    actor_id: owner.userId,
    actor_name: 'Owner',
    action,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    metadata,
  });

  return NextResponse.json({ success: true });
}
