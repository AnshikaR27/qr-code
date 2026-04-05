import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { extractMenuFromImage } from '@/lib/ai-scanner';

const GROQ_SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 });
  }

  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    let imageBuffer: Buffer = rawBuffer;
    let mime = file.type;

    // Convert unsupported formats (e.g. AVIF) to JPEG for Groq
    if (!GROQ_SUPPORTED_TYPES.has(mime)) {
      imageBuffer = Buffer.from(await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer());
      mime = 'image/jpeg';
    }

    const base64 = imageBuffer.toString('base64');
    const dishes = await extractMenuFromImage(base64, mime);
    return NextResponse.json({ dishes });
  } catch (err: unknown) {
    console.error('Menu scan error:', err);
    const message = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
