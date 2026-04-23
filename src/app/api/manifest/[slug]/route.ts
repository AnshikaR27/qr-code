import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/public';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const { data: restaurant } = await supabasePublic
    .from('restaurants')
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  const name = restaurant?.name ?? 'Menu';
  const icons: { src: string; sizes: string; type: string }[] = [];

  if (restaurant?.logo_url) {
    icons.push(
      { src: restaurant.logo_url, sizes: '192x192', type: 'image/png' },
      { src: restaurant.logo_url, sizes: '512x512', type: 'image/png' },
    );
  }

  return NextResponse.json(
    {
      name,
      short_name: name,
      description: `Menu — ${name}`,
      start_url: `/${slug}`,
      display: 'standalone',
      background_color: '#fdf9f0',
      theme_color: '#fdf9f0',
      ...(icons.length > 0 ? { icons } : {}),
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
