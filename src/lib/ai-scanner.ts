import Groq from 'groq-sdk';
import { z } from 'zod';

let groq: Groq | null = null;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

const EXTRACTION_PROMPT = `Extract every dish from this restaurant menu image.
Return a JSON array where each item has:
- name (string, dish name in English)
- name_hindi (string or null, name in Hindi/regional language if visible)
- price (number, lowest price as a number — no currency symbol. If two prices like "750/800", use the lower one: 750)
- category (string, use the section heading from the menu e.g. "Sandwiches", "Wood-Fired Pizzas", "Beverages")
- is_veg (boolean, infer from ingredients: if dish contains meat, chicken, pork, ham, lamb, fish, egg, pepperoni etc. → false. If only vegetables, cheese, paneer, mushrooms etc. → true)
- is_jain (boolean, true ONLY if the menu explicitly says "Jain option available" or "Jain" for that dish, otherwise false)
- description (string or null, the description text below the dish name if present)

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.`;

export const scannedDishSchema = z.object({
  name: z.string().min(1),
  name_hindi: z.string().nullable().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  is_veg: z.boolean(),
  is_jain: z.boolean().optional().default(false),
  description: z.string().nullable().optional(),
});

export type ScannedDish = z.infer<typeof scannedDishSchema>;

export async function extractMenuFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ScannedDish[]> {
  const response = await getGroq().chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  console.log('[ai-scanner] Raw AI response:', text.slice(0, 500));

  // Strip markdown code fences if the model wraps in them
  let json = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // If the model wrapped the array in an object, try to extract it
  // e.g. {"dishes": [...]} or {"menu": [...]}
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // Try to find the first JSON array in the response
    const arrayMatch = json.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        parsed = JSON.parse(arrayMatch[0]);
      } catch {
        throw new Error('AI returned invalid JSON');
      }
    } else {
      throw new Error('AI returned invalid JSON');
    }
  }

  // Unwrap if the model returned { "dishes": [...] } or similar
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const values = Object.values(parsed as Record<string, unknown>);
    const arr = values.find((v) => Array.isArray(v));
    if (arr) parsed = arr;
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array from AI');
  }

  // Validate each item — coerce common issues before validation
  const dishes: ScannedDish[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;

    // Coerce price: strip currency symbols, convert string to number
    if (typeof raw.price === 'string') {
      raw.price = parseFloat((raw.price as string).replace(/[₹$,\s]/g, ''));
    }

    // Coerce is_veg: accept "yes"/"no"/"true"/"false" strings
    if (typeof raw.is_veg === 'string') {
      raw.is_veg = /^(true|yes|veg)$/i.test(raw.is_veg as string);
    }

    const result = scannedDishSchema.safeParse(raw);
    if (result.success) {
      dishes.push(result.data);
    } else {
      console.log('[ai-scanner] Skipped invalid item:', JSON.stringify(raw).slice(0, 200), result.error.issues);
    }
  }

  if (dishes.length === 0) {
    throw new Error('No valid dishes found in the image');
  }

  return dishes;
}
