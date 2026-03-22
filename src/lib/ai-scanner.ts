import Groq from 'groq-sdk';
import { z } from 'zod';

let groq: Groq | null = null;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

const EXTRACTION_PROMPT = `Extract all dishes from this restaurant menu image.
Return a JSON array where each item has:
- name (string, in English)
- name_hindi (string, in Hindi/original language if visible, else null)
- price (number, numeric value only, no currency symbol)
- category (string, e.g. "Starters", "Main Course", "Beverages", "Desserts")
- is_veg (boolean, true if marked veg or no marking visible, false if marked non-veg)
- description (string or null)

Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;

export const scannedDishSchema = z.object({
  name: z.string().min(1),
  name_hindi: z.string().nullable().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  is_veg: z.boolean(),
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

  // Strip markdown code fences if the model wraps in them
  const json = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array from AI');
  }

  // Validate each item — skip malformed ones rather than failing entirely
  const dishes: ScannedDish[] = [];
  for (const item of parsed) {
    const result = scannedDishSchema.safeParse(item);
    if (result.success) dishes.push(result.data);
  }

  if (dishes.length === 0) {
    throw new Error('No valid dishes found in the image');
  }

  return dishes;
}
