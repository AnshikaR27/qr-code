import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const session = await getStaffSession();

  let name = 'MenuQR';
  let icons: { src: string; sizes: string; type: string; purpose: string }[] = [];

  if (session) {
    const admin = getSupabaseAdmin();
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('name, logo_url')
      .eq('id', session.restaurant_id)
      .single();

    if (restaurant) {
      name = restaurant.name;
      const s = session.restaurant_slug;
      icons = [
        { src: `/api/cafe-icon/${s}?size=192&v=2`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `/api/cafe-icon/${s}?size=512&v=2`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ];
    }
  }

  return NextResponse.json(
    {
      name,
      short_name: name,
      description: `Staff dashboard — ${name}`,
      start_url: '/staff/login',
      display: 'standalone',
      background_color: '#f9fafb',
      theme_color: '#09090b',
      ...(icons.length > 0 && { icons }),
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
