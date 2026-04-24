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
      { src: `/api/cafe-icon/${slug}?size=192&v=2`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/api/cafe-icon/${slug}?size=512&v=2`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    );
  }

  const scope = isStaff ? '/' : `/${slug}`;
  const startUrl = isStaff ? `/staff/${slug}` : `/${slug}`;
  const theme = isStaff ? '#09090b' : '#fdf9f0';

  return NextResponse.json(
    {
      name: isStaff ? `${name} Staff` : name,
      short_name: name,
      description: isStaff ? `Staff dashboard — ${name}` : `Menu — ${name}`,
      start_url: startUrl,
      scope,
      display: 'standalone',
      background_color: isStaff ? '#f9fafb' : '#fdf9f0',
      theme_color: theme,
      ...(icons.length > 0 ? { icons } : {}),
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
