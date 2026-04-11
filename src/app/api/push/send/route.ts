import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(req: NextRequest) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }

  let body: { orderId: string; title: string; body: string; url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { orderId, title, body: notifBody, url } = body;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('order_id', orderId);

  if (error) {
    console.error('[push/send] DB error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title: title || 'Order Update',
    body: notifBody || '',
    icon: '/favicon.ico',
    url: url || '/',
  });

  let sent = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };

    try {
      await webPush.sendNotification(pushSub, payload);
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 404 or 410 = subscription expired/unsubscribed
      if (statusCode === 404 || statusCode === 410) {
        expired.push(sub.id);
      } else {
        console.error('[push/send] Failed to send push:', err);
      }
    }
  }

  // Clean up expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired);
  }

  return NextResponse.json({ ok: true, sent });
}
