import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import type { StaffSession } from '@/types';

type AuthResult =
  | { type: 'owner'; userId: string; restaurantId: string }
  | { type: 'staff'; session: StaffSession };

export async function authenticateStaffOrOwner(
  request: NextRequest
): Promise<AuthResult> {
  const staffToken = request.cookies.get('staff_session')?.value;
  if (staffToken) {
    const session = await verifyStaffToken(staffToken);
    if (session) return { type: 'staff', session };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    if (restaurant) {
      return { type: 'owner', userId: user.id, restaurantId: restaurant.id };
    }
  }

  throw new Error('Unauthorized');
}

export function getActorInfo(auth: AuthResult) {
  if (auth.type === 'owner') {
    return {
      actor_type: 'owner' as const,
      actor_id: auth.userId,
      actor_name: 'Owner',
      restaurant_id: auth.restaurantId,
    };
  }
  return {
    actor_type: 'staff' as const,
    actor_id: auth.session.staff_id,
    actor_name: `${auth.session.name} (${auth.session.role})`,
    restaurant_id: auth.session.restaurant_id,
  };
}
