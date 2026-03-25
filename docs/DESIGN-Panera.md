# DESIGN-brewery.md — Premium Restaurant Template

> Claude Code: DELETE all existing menu components and rebuild from scratch.
> Install chroma-js: `npm install chroma-js @types/chroma-js`
> Follow every detail exactly.

---

## 1. Overview

Single scrolling page. Customer lands directly on dishes — no category landing page, no extra taps. Big centered logo in header, sticky category tabs, image-left text-right dish cards, floating filters button, full-width cart bar.

**Reference:** Panera Bread mobile ordering — warm, branded, food-forward, one-scroll menu with sticky navigation.

**Key Principle:** The entire page color system is AUTO-GENERATED from two colors extracted from the restaurant's logo (primary_color + secondary_color). Every restaurant looks uniquely branded without any manual color picking.

---

## 2. Palette System (chroma.js)

**Install:** `npm install chroma-js @types/chroma-js`

**Add to `lib/palette.ts`:**

```typescript
import chroma from 'chroma-js';

export interface BrandPalette {
  // Smooth scale (7 steps between secondary → primary)
  darkest: string;
  dark: string;
  midDark: string;
  base: string;
  midLight: string;
  light: string;
  lightest: string;

  // Original brand colors
  primary: string;
  secondary: string;

  // POP colors — bright, saturated, attention-grabbing
  pop: string;          // ADD buttons, active filters
  neon: string;         // Cart bar, main CTA
  complement: string;   // Opposite hue — for promo banners, special badges

  // Backgrounds
  pageBg: string;       // Warm soft page background
  cardBg: string;       // Slightly warmer than page

  // Gradients
  headerGradient: string;
  ctaGradient: string;
  cardHoverGradient: string;

  // Auto-computed text colors
  popText: string;
  neonText: string;
  primaryText: string;
  secondaryText: string;

  // Subtle texture color
  textureColor: string;
}

export function generatePalette(primary: string, secondary: string): BrandPalette {
  // Ensure valid colors
  const p = chroma.valid(primary) ? primary : '#8B6914';
  const s = chroma.valid(secondary) ? secondary : '#3E2B1A';

  // Smooth scale between secondary (dark) and primary (light)
  const scale = chroma.scale([s, p]).mode('lab').colors(7);

  // Extract hue from primary
  const [h] = chroma(p).hsl();
  const hue = isNaN(h) ? 30 : h; // fallback to warm if achromatic

  // Time-based mood: warmer in morning, moodier in evening
  const hour = new Date().getHours();
  const warmth = hour < 12 ? 0.3 : hour > 18 ? -0.15 : 0;

  // Pop: same hue but max saturation + high lightness
  const popColor = chroma.hsl(hue, 0.85, 0.52);
  // Neon: even more saturated and lighter
  const neonColor = chroma.hsl(hue, 0.95, 0.6);
  // Complement: opposite hue
  const complementColor = chroma.hsl((hue + 180) % 360, 0.65, 0.5);

  // Page background: very light, desaturated, warm — with time adjustment
  const pageBgColor = chroma(p).brighten(2.8 + warmth).desaturate(0.8);
  const cardBgColor = chroma(p).brighten(3.2 + warmth).desaturate(1.2);

  // Smart contrast text
  const textOn = (bg: chroma.Color | string): string =>
    chroma.contrast(bg, '#FFFFFF') > 3 ? '#FFFFFF' : '#1D1D1D';

  return {
    darkest: scale[0],
    dark: scale[1],
    midDark: scale[2],
    base: scale[3],
    midLight: scale[4],
    light: scale[5],
    lightest: scale[6],

    primary: p,
    secondary: s,

    pop: popColor.hex(),
    neon: neonColor.hex(),
    complement: complementColor.hex(),

    pageBg: pageBgColor.hex(),
    cardBg: cardBgColor.hex(),

    headerGradient: `linear-gradient(135deg, ${scale[0]}, ${s})`,
    ctaGradient: `linear-gradient(135deg, ${popColor.hex()}, ${neonColor.hex()})`,
    cardHoverGradient: `linear-gradient(180deg, ${cardBgColor.hex()}, ${chroma(p).brighten(2.5).desaturate(0.6).hex()})`,

    popText: textOn(popColor),
    neonText: textOn(neonColor),
    primaryText: textOn(p),
    secondaryText: textOn(s),

    textureColor: chroma(p).brighten(2).desaturate(0.5).alpha(0.06).css(),
  };
}

// Category-specific hue shift for visual variety
export function getCategoryAccent(baseHue: number, categoryName: string): string {
  const shifts: Record<string, number> = {
    breakfast: -15,
    starters: 0,
    appetizers: 0,
    'main course': 10,
    mains: 10,
    breads: -10,
    rice: 15,
    beverages: 30,
    drinks: 30,
    shakes: 25,
    desserts: -25,
    sweets: -25,
    snacks: 5,
    'cafe specials': 20,
  };
  const shift = shifts[categoryName.toLowerCase()] ?? 0;
  return chroma.hsl((baseHue + shift) % 360, 0.7, 0.5).hex();
}
```

---

## 3. Where Each Palette Color Is Used

| Palette Color | Where Used |
|--------------|------------|
| `secondary` | Navbar background |
| `darkest` | Footer, overlay backgrounds |
| `dark` | Heading text on light backgrounds |
| `midDark` | Body text, icons, secondary text |
| `base` | Active tab underline, section divider lines |
| `midLight` | Inactive elements, subtle borders |
| `light` | Badge backgrounds, hover states |
| `lightest` | Subtle highlights, tag backgrounds |
| `pageBg` | Main page background (NOT pure white — warm tinted) |
| `cardBg` | Dish card backgrounds (slightly warmer than page) |
| `primary` | Active tab text, selected states, brand moments |
| **`pop`** | **ADD buttons, active filter pills, floating filter button** |
| **`neon`** | **Cart bar background, "Place Order" CTA** |
| `complement` | Special badges ("NEW", "Chef's Special"), promo banners |
| `headerGradient` | Navbar background gradient |
| `ctaGradient` | Cart bar, "Add to order" button in detail sheet |
| `cardHoverGradient` | Card hover/active state |
| `textureColor` | Subtle dot-grid pattern on page background |
| `popText` | Text on pop-colored backgrounds |
| `neonText` | Text on neon-colored backgrounds |
| `primaryText` | Text on primary-colored backgrounds |

---

## 4. Typography

Import in `layout.tsx`:
```
Playfair Display: 600, 700, 800  -> logo name, category headings, dish name in detail sheet
Inter: 400, 500, 600, 700, 800   -> everything else
```

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Restaurant name (navbar) | Playfair Display | 22px | 700 | `secondaryText` (auto white/dark) |
| Tagline | Inter | 9px | 600 | rgba(secondaryText, 0.5) uppercase tracking-wide |
| "MENU" dropdown label | Inter | 14px | 900 | `dark` uppercase tracking-widest |
| Category tab active | Inter | 14px | 700 | `dark` |
| Category tab inactive | Inter | 14px | 500 | `midLight` |
| Section heading | Inter | 18px | 800 | `dark` |
| Section subtext | Inter | 13px | 400 | `midDark` |
| Dish name | Inter | 16px | 700 | `dark` |
| Dish hindi name | Inter | 12px | 500 | `midLight` |
| Dish description | Inter | 13px | 400 | `midDark` |
| Dish price | Inter | 16px | 800 | `dark` |
| ADD button text | Inter | 14px | 800 | `popText` |
| Cart bar text | Inter | 15px | 700 | `neonText` |
| Dish name in sheet | Playfair Display | 24px | 700 | `dark` |
| Price in sheet | Inter | 22px | 800 | `dark` |

---

## 5. Page Layout

```
+--------------------------------------+
|  NAVBAR (secondary/gradient bg)      |
|  [☰]  [logo centered]  [cart bag]   |
+--------------------------------------+
|  MENU > CATEGORY dropdown            |
+--------------------------------------+
|  Category Tabs (sticky)              |
|  Tab1 | Tab2 | Tab3 | Tab4    →     |
+--------------------------------------+
|                                      |
|  Section Heading                     |
|  subtitle text                       |
|                                      |
|  +--------------------------------+  |
|  | [IMAGE]  Name              |  |
|  |          Description       |  |
|  |          Price   [⊕ Add]   |  |
|  +--------------------------------+  |
|                                      |
|  +--------------------------------+  |
|  | [IMAGE]  Name              |  |
|  |          Description       |  |
|  |          Price   [⊕ Add]   |  |
|  +--------------------------------+  |
|                                      |
|  Next Section Heading                |
|  ...                                 |
|                                      |
|              [🔽 Filters]            |  <- floating pill, bottom-right
+--------------------------------------+
|  CART BAR (neon/ctaGradient bg)      |
|  [count]  View Cart       ₹total    |
+--------------------------------------+

TAP DISH → BOTTOM SHEET:
+--------------------------------------+
|  -- handle --                        |
|  [big photo if exists]               |
|  [veg] [badges]                      |
|  Dish Name (Playfair)                |
|  hindi name                          |
|  ₹price  spice                       |
|  Full description...                 |
|  ---------------------------------   |
|  [−] [1] [+]  [Add to order ₹XXX]   |
+--------------------------------------+
```

---

## 6. Component Specifications

### 6.1 Navbar

```
Background:     headerGradient (gradient of secondary → darkest)
Padding:        14px 16px
Position:       sticky, top 0, z-index 30
```

**Layout:** Three columns — left (hamburger), center (logo), right (cart)

**Left — Menu icon (optional):**
- ☰ icon, 24px, color `secondaryText`
- Not needed for MVP — can skip. Just leave empty space.

**Center — Logo (THE HERO):**
- If `logo_url` exists: show image, max-height 48px, auto width, object-fit contain. Centered.
- If NO logo: restaurant name in Playfair Display, 22px, weight 700, color `secondaryText`, centered. Tagline below in Inter 9px, weight 600, rgba(secondaryText, 0.5), uppercase, letter-spacing 0.15em.
- Logo should feel prominent — it's the identity of the page.

**Right — Cart bag:**
- Shopping bag icon (from lucide-react), 22px, color `secondaryText`
- Background: `pop` color, 42x42 rounded-full
- Text color on bag: `popText`
- Item count number next to bag icon, weight 800
- If cart is empty: show bag with "0" in muted color
- If cart has items: bag with count, slight scale pulse animation

### 6.2 Menu Category Dropdown

```
Padding:        12px 16px
Background:     pageBg
Border-bottom:  1.5px solid light
```

- Text: "MENU > [CATEGORY NAME]" 
- "MENU" in Inter 14px weight 900, color `dark`, uppercase, letter-spacing 0.15em
- ">" chevron in `midLight`
- Category name in Inter 14px weight 900, color `dark`, uppercase
- On tap: opens a dropdown/bottom-sheet listing all categories. Tapping one scrolls to that section.

### 6.3 Category Tabs (sticky)

```
Position:       sticky, top [navbar-height], z-index 20
Background:     pageBg
Border-bottom:  1.5px solid light
Padding:        0 16px
Scroll:         horizontal, hide scrollbar
```

- **Active tab:** color `dark`, weight 700, border-bottom 3px solid `base` (category-specific accent if enabled), padding-bottom 12px
- **Inactive tab:** color `midLight`, weight 500, border-bottom 3px solid transparent
- **Font:** Inter, 14px
- **Gap:** 24px between tabs
- **Tab padding:** 12px 0 (vertical)
- Smooth scroll snap

### 6.4 Section Heading

Appears before each category's dishes.

```
Padding:        24px 16px 8px
```

- **Heading:** Inter 18px weight 800, color `dark`
- **Subtitle** (optional): Inter 13px weight 400, color `midDark`, margin-top 4px. E.g., "Customize to slice or toast your bagel."
- **Category accent line:** 3px height, 40px width, border-radius 2px, background `base` (or category-specific accent). Below heading, margin-top 8px.

### 6.5 Dish Card (Image Left, Text Right — like Panera)

```
Background:     cardBg
Margin:         0 16px 12px
Border-radius:  16px
Border:         1px solid light
Overflow:       hidden
Cursor:         pointer
Transition:     all 0.2s ease
```

**Hover/active:** background shifts to `cardHoverGradient`, border-color `midLight`, subtle scale(0.99)

**Layout:** flex row

**Left — Image:**
- Width: 130px (fixed), flex-shrink 0
- Height: 130px (square)
- Border-radius: 12px (rounded inside the card)
- Margin: 12px 0 12px 12px
- Overflow: hidden
- If image exists: object-fit cover
- If NO image: skip image entirely. Card becomes text-only, full-width content. No placeholder, no grey box.

**Right — Content:**
- Padding: 14px 14px 14px 14px
- Flex: 1, display flex, flex-direction column, justify space-between

**Row 1 — Badges + Name:**
- Veg badge: standard Indian 16x16 SVG (green square + circle for veg, red for non-veg). Use `#0F8A00` for veg, `#E23744` for non-veg.
- Dish name: Inter 16px weight 700, color `dark`, margin-left 8px
- If bestseller (top 3 by order_count): small badge "🔥 Popular" — background `complement`, white text, 9px weight 800, border-radius 4px, padding 2px 6px
- If Jain: "JAIN" badge — background `lightest`, color `base`, 9px weight 800

**Row 2 — Hindi name (if exists):**
- Inter 12px weight 500, color `midLight`

**Row 3 — Description (if exists):**
- Inter 13px weight 400, color `midDark`
- Max 2 lines with ellipsis

**Row 4 — Price + Add button:**
- Layout: flex row, justify space-between, align center, margin-top auto
- Price: Inter 16px weight 800, color `dark`
- Spice: chili emojis 🌶️ after price if spice > 0
- **ADD button:**
  - Background: `pop`
  - Color: `popText`
  - Text: "⊕ Add" — Inter 14px weight 800
  - Padding: 8px 18px
  - Border-radius: 50px (fully rounded pill)
  - Box-shadow: 0 2px 10px rgba(pop, 0.3)
  - Active: scale(0.95)
  - When qty > 0: morphs into `[− count +]` stepper, same pill shape
    - `−` and `+`: color `popText`, weight 700
    - Count: `popText`, weight 800
    - Background stays `pop`

**Unavailable dish:**
- Entire card opacity 0.4
- ADD button hidden
- Red "Sold out" text: #E23744, Inter 12px weight 700

**Card tap → opens Dish Detail Bottom Sheet**

### 6.6 Floating Filters Button

```
Position:       fixed, bottom 80px (above cart bar), right 16px, z-index 40
```

- Pill shape: padding 10px 18px, border-radius 50px
- Background: `darkest`
- Color: white
- Text: "🔽 Filters" — Inter 13px weight 700
- Shadow: 0 4px 16px rgba(0,0,0,0.2)
- On tap: opens a bottom sheet with filter options
- **Filter options:** Veg, Non-Veg, Jain toggles + Spice level slider + Sort by (Popular, Price low-high, Price high-low)
- Hidden when scrolling down, visible when scrolling up or idle

### 6.7 Dish Detail Bottom Sheet

Opens when user taps a dish card.

**Overlay:**
```css
position: fixed;
inset: 0;
z-index: 100;
background: rgba(0, 0, 0, 0.5);
display: flex;
align-items: flex-end;
justify-content: center;
```

**Sheet:**
```css
width: 100%;
max-width: 420px;
background: [cardBg];
border-radius: 24px 24px 0 0;
max-height: 85vh;
overflow-y: auto;
box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
animation: sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
```

```css
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
/* ONLY translateY — flex handles centering */
```

**Handle:** 40x5px centered, color `light`, border-radius 3px, margin 12px auto 8px

**Content (padding 16px 20px 32px):**

1. **Photo** (if exists):
   - Full width, aspect-ratio 16/10, border-radius 16px, overflow hidden, margin-bottom 16px
   - object-fit cover

2. **Badges row** (flex, gap 6, margin-bottom 8):
   - Veg SVG 18x18
   - "🔥 Popular" badge if bestseller (bg `complement`, white text)
   - "JAIN" badge if applicable (bg `lightest`, color `base`)
   - "NEW" badge if dish was added recently (bg `complement`, white text)

3. **Dish name:** Playfair Display 24px weight 700, color `dark`, line-height 1.2

4. **Hindi name:** Inter 14px weight 500, color `midLight`, margin-top 4px

5. **Price + spice** (margin-top 12px):
   - Price: Inter 22px weight 800, color `dark`
   - Spice: chili emojis at 16px

6. **Description** (margin-top 14px):
   - Inter 14px weight 400, color `midDark`, line-height 1.65
   - Full text, no clamp

7. **Allergen tags** (if any, margin-top 10px):
   - Small pills: bg `lightest`, color `midDark`, Inter 11px weight 600
   - "Contains: Dairy, Nuts"

8. **Divider:** 1px solid `light`, margin 20px 0

9. **Action row** (flex, gap 12, align center):
   - **Qty control:** border 1.5px solid `light`, border-radius 14px, overflow hidden, bg `pageBg`
     - `−` button: 48x48, color `midDark`, font 20px weight 700
     - Count: 40px center, Inter 18px weight 800, color `dark`
     - `+` button: 48x48, color `midDark`
   - **"Add to order" button:** flex 1, padding 16px, border-radius 14px
     - Background: `ctaGradient`
     - Color: `neonText`
     - Font: Inter 16px weight 700
     - Shadow: 0 4px 20px rgba(neon, 0.3)
     - Text: "Add to order · ₹XXX"
     - Active: scale(0.97)

### 6.8 Cart Bar (Fixed Bottom)

```
Position:       fixed, bottom 0, z-index 50
Max-width:      420px, centered (left 50%, translateX -50%)
Padding:        8px 16px env(safe-area-inset-bottom, 16px)
Width:          100%
```

- **Frost backdrop:** linear-gradient(to top, pageBg 60%, transparent)
- **Bar:** flex row, justify space-between, align center
  - Padding: 16px 20px
  - Border-radius: 16px
  - Background: `ctaGradient`
  - Color: `neonText`
  - Shadow: 0 4px 24px rgba(neon, 0.35)
- **Left:** count badge (28px circle, rgba(0,0,0,0.15) bg, weight 900) + "View Cart" Inter 15px weight 700
- **Right:** "₹XXX" Inter 18px weight 800
- **Animation:** spring bounce on first item:
```css
@keyframes cartBounce {
  0%   { transform: translateY(100%); }
  60%  { transform: translateY(-5px); }
  100% { transform: translateY(0); }
}
```
- **Hidden when cart is empty**
- On tap: open CartSheet

---

## 7. Subtle Background Texture

Add a faint pattern on the page background so it doesn't feel flat:

```css
/* Apply to the page container */
background-color: [pageBg];
background-image: radial-gradient(
  circle,
  [textureColor] 1px,
  transparent 1px
);
background-size: 20px 20px;
```

This creates a barely-visible dot grid in the brand's tone. Different restaurant = different colored dots. Adds depth without distraction.

---

## 8. Animations

```css
/* Dish cards stagger in */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* animation-delay: index * 40ms */

/* Bottom sheet */
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
/* 0.3s cubic-bezier(0.32, 0.72, 0, 1) */

/* Cart bar */
@keyframes cartBounce {
  0%   { transform: translateY(100%); }
  60%  { transform: translateY(-5px); }
  100% { transform: translateY(0); }
}
/* 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) */

/* ADD button tap */
@keyframes addPop {
  0%   { transform: scale(1); }
  50%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}

/* Floating filters: hide on scroll down, show on scroll up */
/* Use IntersectionObserver or scroll direction detection */

/* Cart bag pulse when item added */
@keyframes bagPulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
/* 0.3s ease */
```

---

## 9. Edge Cases

- **No logo image:** show restaurant name as styled text (Playfair Display centered) — no circle, no placeholder
- **No dish image:** skip image area entirely, card becomes text-only with full-width content
- **Light primary_color (cream/yellow):** chroma.js handles all contrast automatically via `popText`, `neonText` etc.
- **Very similar primary + secondary:** scale still works, pop/neon add the needed contrast
- **Single dish in section:** full-width card, no layout issues
- **Long dish name:** max 2 lines ellipsis in card, full text in sheet
- **Dish unavailable:** opacity 0.4, add button hidden, "Sold out" in red
- **Empty cart:** cart bar hidden, bag in header shows "0" muted
- **Category with 0 dishes after filter:** hide section heading entirely
- **Page at different times of day:** pageBg shifts slightly warmer (morning) or cooler (evening) via mood system

---

## 10. What NOT to Do

- ❌ NO separate category landing page — single scroll with sticky tabs
- ❌ NO pure white (#FFF) background — always use warm `pageBg`
- ❌ NO pure black (#000) text — use palette `dark` and `midDark`
- ❌ NO hardcoded accent colors — everything from `generatePalette()`
- ❌ NO manual color values in components — import palette, use its properties
- ❌ NO small left-aligned logo — logo is CENTERED and PROMINENT
- ❌ NO two cart elements on same screen
- ❌ NO translateX in bottom sheet animation
- ❌ NO grey placeholders for missing dish images
- ❌ NO separate CSS files — inline styles or Tailwind
- ❌ NO removing cart/filter/Supabase functionality

---

## 11. What TO Do

- ✅ Install chroma-js and create `lib/palette.ts`
- ✅ Generate full palette from primary + secondary on server, pass to all components
- ✅ Single scrolling page with sticky category tabs
- ✅ Big centered logo in navbar
- ✅ Image-left text-right dish cards (Panera style)
- ✅ `pop` color for ADD buttons (bright, saturated)
- ✅ `neon`/`ctaGradient` for cart bar and main CTAs
- ✅ `complement` color for special badges
- ✅ Warm `pageBg` with subtle dot-grid texture
- ✅ Time-based mood shift on page background
- ✅ Category-specific accent colors for section dividers
- ✅ Floating "Filters" pill button
- ✅ Bottom sheet for dish details (flex-centered, translateY only)
- ✅ Playfair Display for logo + headings, Inter for body
- ✅ Staggered fade-up animations on dish cards
- ✅ Spring bounce on cart bar appearance
- ✅ Cart bag pulse animation when item added

---

## 12. Files to Create

```
src/lib/palette.ts                       <- generatePalette(), getCategoryAccent(), BrandPalette type

src/components/menu/
  MenuNavbar.tsx                          <- gradient header, centered logo, cart bag
  MenuDropdown.tsx                        <- "MENU > CATEGORY" dropdown selector
  CategoryTabs.tsx                        <- sticky horizontal tabs with underline
  SectionHeading.tsx                      <- category heading + subtitle + accent line
  DishCard.tsx                            <- image-left text-right card (Panera style)
  DishDetailSheet.tsx                     <- bottom sheet with full details
  FloatingFilters.tsx                     <- floating "Filters" pill + filter sheet
  CartBar.tsx                             <- full-width gradient cart bar
  CartSheet.tsx                           <- existing cart panel (keep/adapt)

src/app/[slug]/CustomerMenu.tsx           <- single scroll page, palette generation, all state
```

---

## 13. State Architecture

```typescript
// CustomerMenu.tsx
const palette = generatePalette(restaurant.primary_color, restaurant.secondary_color);

const [activeTab, setActiveTab] = useState<string>(categories[0]?.id ?? 'all');
const [dietFilter, setDietFilter] = useState<DietFilter>('all');
const [search, setSearch] = useState('');
const [selectedDish, setSelectedDish] = useState<Product | null>(null);
const [cartOpen, setCartOpen] = useState(false);
const [filtersOpen, setFiltersOpen] = useState(false);

// Pass palette as prop to ALL child components
// Every component reads colors from palette, never hardcoded
```

---

## 14. Palette Generation Flow

```
1. Owner uploads logo during signup/settings
2. colorthief extracts primary_color + secondary_color
3. Colors saved to restaurants table in Supabase
4. Customer opens menu page
5. Server component fetches restaurant data (including colors)
6. generatePalette(primary, secondary) runs on server
7. Full palette passed to CustomerMenu client component
8. Every child component receives palette as prop
9. All colors rendered from palette — zero hardcoded values
10. Result: every restaurant automatically looks uniquely branded
```
