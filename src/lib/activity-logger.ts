import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ActorType } from '@/types';

interface LogParams {
  restaurant_id: string;
  actor_type: ActorType;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin.from('activity_log').insert({
      restaurant_id: params.restaurant_id,
      actor_type: params.actor_type,
      actor_id: params.actor_id ?? null,
      actor_name: params.actor_name ?? null,
      action: params.action,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // fire-and-forget — never block the main request
  }
}
