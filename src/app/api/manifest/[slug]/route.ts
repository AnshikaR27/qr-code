import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/public';

// Cloudinary URLs support on-the-fly resizing via URL transforms.
// For non-Cloudinary URLs we reference the original — cafes should
// upload logos at 512×512 minimum for crisp adaptive icons.
function resizedIcon(url: string, size: number): string {
  const m = url.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*?)(v\d+\/.+)$/,
  );
  if (!m) return url;
  return `${m[1]}w_${size},h_${size},c_fill,f_png,q_auto/${m[3]}`;
}

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
      { src: resizedIcon(restaurant.logo_url, 192), sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: resizedIcon(restaurant.logo_url, 512), sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    );
  }

  const scope = isStaff ? '/staff-dashboard' : `/${slug}`;
  const startUrl = isStaff ? '/staff/login' : `/${slug}`;
  const bg = isStaff ? '#ffffff' : '#fdf9f0';
  const theme = isStaff ? '#09090b' : '#fdf9f0';

  return NextResponse.json(
    {
      name: isStaff ? `${name} Staff` : name,
      short_name: name,
      description: isStaff ? `Staff dashboard — ${name}` : `Menu — ${name}`,
      start_url: startUrl,
      scope,
      display: 'standalone',
      background_color: bg,
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
