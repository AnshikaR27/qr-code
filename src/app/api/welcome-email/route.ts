import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeEmail } from '@/lib/resend';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { restaurantName, slug } = await req.json();

  if (!restaurantName || !slug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    await sendWelcomeEmail({ to: user.email!, restaurantName, slug });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Welcome email failed:', err);
    // Don't block registration if email fails
    return NextResponse.json({ ok: false, error: 'Email failed' }, { status: 200 });
  }
}
