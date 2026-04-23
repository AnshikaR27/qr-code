import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/public';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const isStaff = new URL(req.url).searchParams.get('staff') === '1';

  const { data: restaurant } = await supabasePublic
    .from('restaurants')
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  const name = restaurant?.name ?? 'Menu';
  const icons: { src: string; sizes: string; type: string; purpose: string }[] = [];

  if (restaurant?.logo_url) {
    icons.push(
      { src: restaurant.logo_url, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: restaurant.logo_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
    );
  }

  return NextResponse.json(
    {
      name: isStaff ? `${name} Staff` : name,
      short_name: name,
      description: isStaff ? `Staff dashboard — ${name}` : `Menu — ${name}`,
      start_url: isStaff ? '/staff/login' : `/${slug}`,
      display: 'standalone',
      background_color: isStaff ? '#ffffff' : '#fdf9f0',
      theme_color: isStaff ? '#09090b' : '#fdf9f0',
      ...(icons.length > 0 ? { icons } : {}),
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
