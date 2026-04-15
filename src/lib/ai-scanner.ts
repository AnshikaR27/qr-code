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
- category (string) — RULES:
  • Use a SHORT, GENERIC food category name (e.g. "Shakes", "Cold Coffee", "Starters", "Main Course", "Desserts", "Pizza", "Biryani").
  • IGNORE decorative/marketing words in menu headers. Strip out words like "Extreme", "Ultimate", "Signature", "Special", "Premium", "House", "Chef's", "Classic", "Authentic", "Traditional", "Original".
  • If the header is styled/branded (e.g. "Extreme Dessert FreakShakes", "The Ultimate Pizza Experience"), extract only the underlying food type: "Shakes", "Pizza".
  • Prefer singular generic terms customers would search for.
- parent_category (string or null) — RULES:
  • Only set when there is a genuine two-level hierarchy on the menu (e.g. "Beverages > Cold Coffee", "Main Course > North Indian").
  • Marketing taglines, hashtags, or decorative words (e.g. "#TheUltimateIndulgence", "Extreme Dessert") are NOT parent categories — use null in those cases.
  • If there is no real parent section, use null.
  • Example: menu header "Beverages — Cold Coffee" → category="Cold Coffee", parent_category="Beverages".
  • Example: menu header "🔥 Extreme Dessert FreakShakes #TheUltimateIndulgence" → category="Shakes", parent_category=null.
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

const MARKETING_WORDS = /\b(extreme|ultimate|signature|premium|special|house|chef'?s|classic|authentic|traditional|original|the)\b/gi;

function cleanCategory(cat: string): string {
  return cat
    .replace(MARKETING_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  mimeType: string,
  existingCategories: string[] = []
): Promise<ScannedDish[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Build dynamic prompt additions based on context
  const categoryHint = existingCategories.length > 0
    ? `\n\nEXISTING CATEGORIES IN THIS RESTAURANT (reuse these EXACT names when a dish fits, do NOT create duplicates): ${existingCategories.join(', ')}`
    : '';

  const jainRule = `\n\nJAIN FOOD RULE: If a page/section is titled "Jain Food" or "Special Jain Food", do NOT use "Jain Food" as the category. Instead, assign each dish to its real food category (e.g. a "Margarita Pizza" on the Jain page → category: "Pizza", is_jain: "Yes"). These are Jain-friendly versions of existing dishes, not a separate category.`;

  const parentRule = `\n\nPARENT CATEGORY RULE: Only set parent_category when the menu VISIBLY shows multiple sub-sections under one parent header (e.g. "Beverages" containing both "Hot Tea" and "Iced Tea" sub-sections). If a section like "Hot Tea" stands alone with no visible sibling sub-category on the same page, leave parent_category null. A tagline like "Where there's Tea, there's hope!" is NOT a parent category. Never invent a parent that has only one child — flatten it.`;

  const fullPrompt = EXTRACTION_PROMPT + categoryHint + jainRule + parentRule;

  const result = await model.generateContent([
    fullPrompt,
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
      const dish = result.data;
      // Clean marketing/decorative words from category names
      if (dish.category) {
        dish.category = cleanCategory(dish.category) || dish.category;
      }
      if (dish.parent_category) {
        const cleaned = cleanCategory(dish.parent_category);
        // Drop parent if it becomes empty or identical to category after cleaning
        dish.parent_category = (!cleaned || cleaned === dish.category) ? null : cleaned;
      }
      dishes.push(dish);
    } else {
      console.log('[ai-scanner] Skipped invalid item:', JSON.stringify(raw).slice(0, 200), result.error.issues);
    }
  }

  // ── Post-processing: flatten parent categories with only one child ──
  const parentChildMap = new Map<string, Set<string>>();
  for (const d of dishes) {
    if (d.parent_category) {
      if (!parentChildMap.has(d.parent_category)) {
        parentChildMap.set(d.parent_category, new Set());
      }
      parentChildMap.get(d.parent_category)!.add(d.category);
    }
  }
  for (const d of dishes) {
    if (d.parent_category) {
      const children = parentChildMap.get(d.parent_category);
      // If parent has only one child category, the hierarchy is pointless — flatten
      if (children && children.size <= 1) {
        d.parent_category = null;
      }
    }
  }

  if (dishes.length === 0) {
    throw new Error('No valid dishes found in the image');
  }

  return dishes;
}