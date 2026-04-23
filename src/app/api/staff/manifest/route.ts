import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const session = await getStaffSession();

  let name = 'MenuQR';
  let icons: { src: string; sizes: string; type: string }[] = [];

  if (session) {
    const admin = getSupabaseAdmin();
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('name, logo_url')
      .eq('id', session.restaurant_id)
      .single();

    if (restaurant) {
      name = restaurant.name;
      if (restaurant.logo_url) {
        icons = [
          { src: restaurant.logo_url, sizes: '192x192', type: 'image/png' },
          { src: restaurant.logo_url, sizes: '512x512', type: 'image/png' },
        ];
      }
    }
  }

  return NextResponse.json(
    {
      name,
      short_name: name,
      description: `Staff dashboard — ${name}`,
      start_url: '/staff/login',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#09090b',
      ...(icons.length > 0 ? { icons } : {}),
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
