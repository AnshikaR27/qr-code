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
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  let icon: Buffer;

  if (restaurant.logo_url) {
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

    icon = await sharp({
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
  } else {
    const letter = (restaurant.name ?? slug)[0].toUpperCase();
    const fontSize = Math.round(size * 0.48);
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#09090b"/>
      <text x="50%" y="50%" dy=".1em" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui,sans-serif" font-weight="700" font-size="${fontSize}" fill="#fff">
        ${letter}
      </text>
    </svg>`;
    icon = await sharp(Buffer.from(svg)).png().toBuffer();
  }

  return new NextResponse(new Uint8Array(icon), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
