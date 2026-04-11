import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: { orderId: string; subscription: PushSubscriptionJSON };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { orderId, subscription } = body;
  if (!orderId || !subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Upsert — avoid duplicate subscriptions for the same order+endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        order_id: orderId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      { onConflict: 'order_id,endpoint', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[push/subscribe] DB error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
