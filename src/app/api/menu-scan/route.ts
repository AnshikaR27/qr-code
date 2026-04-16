import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { extractMenuFromImage } from '@/lib/ai-scanner';

const GEMINI_SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const pin = (formData.get('pin') as string | null)?.trim();
  const scanPin = process.env.SCAN_PIN;
  if (!pin || pin !== scanPin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 403 });
  }

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

    // Convert unsupported formats (e.g. AVIF, GIF) to JPEG for Gemini
    if (!GEMINI_SUPPORTED_TYPES.has(mime)) {
      imageBuffer = Buffer.from(await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer());
      mime = 'image/jpeg';
    }

    const base64 = imageBuffer.toString('base64');

    // Fetch existing categories so the AI reuses them instead of inventing new ones
    const { data: existingCats } = await supabase
      .from('categories')
      .select('name')
      .eq('restaurant_id', user.id)
      .order('sort_order');
    const existingCategories = existingCats?.map(c => c.name) ?? [];

    const dishes = await extractMenuFromImage(base64, mime, existingCategories);
    return NextResponse.json({ dishes });
  } catch (err: unknown) {
    console.error('Menu scan error:', err);
    const message = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}