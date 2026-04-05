import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI;
}

const EXTRACTION_PROMPT = `Extract every dish from this restaurant menu image.
Return a JSON array where each item has:
- name (string, dish name in English)
- name_hindi (string or null, name in Hindi/regional language if visible)
- price (number, lowest price as a number — no currency symbol. If two prices like "750/800", use the lower one: 750)
- category (string, the most specific section/sub-section heading this dish falls under, e.g. "Black & Bold", "Timeless Brews", "Wood-Fired Pizzas")
- parent_category (string or null, if the dish's section is a sub-section of a larger section, put the larger section name here. For example if "COFFEE" is the main heading and "Black & Bold" is a sub-heading, then category="Black & Bold" and parent_category="Coffee". If there is no parent section, use null)
- is_veg (boolean, infer from ingredients: if dish contains meat, chicken, pork, ham, lamb, fish, egg, pepperoni etc. → false. If only vegetables, cheese, paneer, mushrooms etc. → true)
- is_jain (boolean, true ONLY if the menu explicitly says "Jain option available" or "Jain" for that dish, otherwise false)
- description (string or null, the description text below the dish name if present)
- is_addon (boolean, true if this item is from an "Add-ons", "Sides", "Extras", "Toppings", or "Customizations" section that is meant to complement main dishes. false for regular menu items)

IMPORTANT for add-ons/sides: If the menu has a section like "Add-ons & Sides" or "Extras" that clearly belongs to a main category (e.g. appears under "Main Bowls"), set parent_category to that main category name.

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.`;

export const scannedDishSchema = z.object({
  name: z.string().min(1),
  name_hindi: z.string().nullable().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  parent_category: z.string().nullable().optional(),
  is_veg: z.boolean(),
  is_jain: z.boolean().optional().default(false),
  description: z.string().nullable().optional(),
  is_addon: z.boolean().optional().default(false),
});

export type ScannedDish = z.infer<typeof scannedDishSchema>;

export async function extractMenuFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ScannedDish[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text().trim();
  console.log('[ai-scanner] Raw Gemini response:', text.slice(0, 500));

  // Strip markdown code fences if the model wraps in them
  let json = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // If the model wrapped the array in an object, try to extract it
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
