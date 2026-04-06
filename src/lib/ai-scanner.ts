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
- is_veg (boolean — Determine this from ALL available signals:
  1. Green dot/square symbol (●/◻) next to the item → true. Red/brown dot/square symbol → false.
  2. Tags like "Vegan", "Vegetarian", "Eggless", "Jain" → true. Tags like "Contains Egg", "Non-Veg" → false.
  3. Ingredient inference: chicken, prawns, bacon, lamb, pork, ham, fish, egg, pepperoni, mutton, keema, seafood → false. Only vegetables, cheese, paneer, mushrooms, tofu → true.
  4. If a section is explicitly labeled "Non-Veg" or "Non Vegetarian", ALL items in it are false.
  5. When in doubt and no indicators are present, infer from the dish name — e.g. "Chicken Tikka" → false, "Paneer Tikka" → true.
  IMPORTANT: You MUST actively mark non-veg items as false. Do not default everything to true.)
- is_jain (string — "Yes" if the menu explicitly tags the dish as "Jain". "Jain option available" if that phrase appears. "No" otherwise)
- description (string or null, the description text below the dish name if present)
- is_addon (boolean, true if this item is from an "Add-ons", "Sides", "Extras", "Toppings", or "Customizations" section that is meant to complement main dishes. false for regular menu items)
- dietary_tags (string or null — extract ALL dietary/allergen tags shown for the dish. These are typically in smaller font, different color, or as a subtitle below the item name. Look for tags like: "Vegan", "Vegetarian", "Eggless", "Gluten Free", "Sugar Free", "Jain", "Jain option available", "Vegan option available", "Eggless option available", "Contains Egg", "Contains Egg & Gluten Free". Return as a comma-separated string, e.g. "Vegan, Gluten Free". If no tags are present, use null)

IMPORTANT for dietary tags: Do NOT skip or ignore colored or small-font text beneath item names — these are dietary indicators, not decorative elements. Extract them exactly as shown.

IMPORTANT for add-ons/sides: If the menu has a section like "Add-ons & Sides" or "Extras" that clearly belongs to a main category (e.g. appears under "Main Bowls"), set parent_category to that main category name.

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.`;

export const scannedDishSchema = z.object({
  name: z.string().min(1),
  name_hindi: z.string().nullable().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  parent_category: z.string().nullable().optional(),
  is_veg: z.boolean(),
  is_jain: z.string().optional().default('No'),
  description: z.string().nullable().optional(),
  is_addon: z.boolean().optional().default(false),
  dietary_tags: z.string().nullable().optional(),
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

    // Coerce is_jain: convert boolean to string
    if (typeof raw.is_jain === 'boolean') {
      raw.is_jain = raw.is_jain ? 'Yes' : 'No';
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
