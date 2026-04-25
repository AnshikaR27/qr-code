import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/staff-permissions';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const token = req.cookies.get('staff_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyStaffToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  if (!hasPermission(session.role, 'waiter_call:dismiss')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { callId } = await params;
  const admin = getSupabaseAdmin();

  const { data: call, error: fetchError } = await admin
    .from('waiter_calls')
    .select('id, restaurant_id')
    .eq('id', callId)
    .single();

  if (fetchError || !call) {
    return NextResponse.json({ error: 'Waiter call not found' }, { status: 404 });
  }

  if (call.restaurant_id !== session.restaurant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await admin
    .from('waiter_calls')
    .update({ status: 'acknowledged' })
    .eq('id', callId);

  if (updateError) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
