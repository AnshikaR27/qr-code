import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // Only authenticated dashboard users can call this
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { dishName, categoryName } = body as { dishName?: string; categoryName?: string };

  if (!dishName || typeof dishName !== 'string' || dishName.trim().length < 2) {
    return NextResponse.json({ error: 'Invalid dish name' }, { status: 400 });
  }

  const categoryContext = categoryName?.trim()
    ? `\nThis dish belongs to the "${categoryName.trim()}" category.`
    : '';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: 'You are a menu writer for an Indian restaurant. When given a dish name, reply with only a short appetizing description — maximum 15 words, no quotation marks, do not start with "A" or "Our". Examples: Paneer Tikka → Smoky chargrilled cottage cheese marinated in robust tandoori spices. Dal Makhani → Slow-simmered black lentils finished with cream and butter.',
          },
          {
            role: 'user',
            content: `Dish: "${dishName.trim()}".${categoryContext}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[generate-description] Groq error:', response.status);
      return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
    }

    const data = await response.json() as { choices?: { message: { content: string } }[] };
    const description = data.choices?.[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ description });
  } catch (err) {
    console.error('[generate-description] error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
