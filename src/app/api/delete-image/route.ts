import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@/lib/supabase/server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ error: 'No url provided' }, { status: 400 });

  const publicId = extractPublicId(url);
  if (!publicId) return NextResponse.json({ error: 'Could not parse image URL' }, { status: 400 });

  try {
    await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Cloudinary delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
