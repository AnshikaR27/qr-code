import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabasePublic } from '@/lib/supabase/public';

const ALLOWED_SIZES = [180, 192, 512];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const size = parseInt(url.searchParams.get('size') ?? '512', 10);

  if (!ALLOWED_SIZES.includes(size)) {
    return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
  }

  const { data: restaurant } = await supabasePublic
    .from('restaurants')
    .select('logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!restaurant?.logo_url) {
    return NextResponse.json({ error: 'No logo' }, { status: 404 });
  }

  const logoRes = await fetch(restaurant.logo_url);
  if (!logoRes.ok) {
    return NextResponse.json({ error: 'Logo fetch failed' }, { status: 502 });
  }

  const logoBuffer = Buffer.from(await logoRes.arrayBuffer());

  const inner = Math.round(size * 0.72);

  const resizedLogo = await sharp(logoBuffer)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const icon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  return new NextResponse(new Uint8Array(icon), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
