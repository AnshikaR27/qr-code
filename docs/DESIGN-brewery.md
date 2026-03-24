# DESIGN-brewery.md — The Brewery Template

> Claude Code: DELETE all existing menu components and rebuild from scratch.
> Follow every single detail exactly. Do not deviate.

---

## 1. Overview

This menu has TWO VIEWS managed by React state (NOT separate routes):

**View 1 — Category Browser (landing)**
Dark background (brand-derived). White cards in a 2-column grid. Each card has a large food photo + category name. Customer taps a category to enter it.

**View 2 — Dish List (inside a category)**
White background. Full-width dish cards stacked vertically. Each card has a big photo on top, dish info below. Back button returns to View 1.

State: `selectedCategory` — when null = View 1, when set = View 2.

---

## 2. CRITICAL — Brand-Adaptive Colors

The dark background is NOT always black. It adapts to the restaurant's brand.

**Add to `lib/utils.ts`:**

```typescript
export function getContrastText(hexColor: string): '#FFFFFF' | '#1D1D1D' {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1D1D1D' : '#FFFFFF';
}

export function getSafeAccent(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.7) {
    return `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`;
  }
  return hexColor;
}

// Creates a very dark version of any color for premium dark backgrounds
export function getDarkBrand(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Darken to ~8-12% of original — creates a rich deep tone
  return `rgb(${Math.floor(r * 0.1 + 5)}, ${Math.floor(g * 0.1 + 5)}, ${Math.floor(b * 0.1 + 5)})`;
}

// Slightly lighter version for navbar distinction
export function getNavbarBrand(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Darken to ~15-18% of original — slightly lighter than page bg
  return `rgb(${Math.floor(r * 0.15 + 10)}, ${Math.floor(g * 0.15 + 10)}, ${Math.floor(b * 0.15 + 10)})`;
}
```

**Examples of how this works:**

| Restaurant | primary_color | Page Background (getDarkBrand) | Navbar (getNavbarBrand) |
|-----------|--------------|-------------------------------|------------------------|
| Anshika's Cafe | #8B6914 (brown) | very dark brown #121008 | slightly lighter brown #1B1710 |
| Blue Lagoon | #1565C0 (blue) | very deep navy #07101A | slightly lighter navy #0F1A2A |
| Green Garden | #2E7D32 (green) | very dark forest #080D08 | slightly lighter #0F170F |
| Pink Cafe | #E91E63 (pink) | very deep maroon #120712 | slightly lighter #1C0C1C |
| Default (no color) | #333333 (grey) | near black #080808 | dark grey #0F0F0F |

Every restaurant gets its own unique dark atmosphere derived from their brand color.

---

## 3. Colors

**View 1 (Category Browser):**
```
Page background:     getDarkBrand(primary_color)  ← NOT hardcoded #000
Navbar background:   getNavbarBrand(primary_color) ← slightly lighter, visually distinct
Navbar border:       1px solid rgba(255,255,255,0.08) ← subtle bottom border
Card background:     #FFFFFF
Card text:           #1D1D1D
Heading text:        #FFFFFF
```

**View 2 (Dish List):**
```
Page background:     #FFFFFF
Navbar background:   #FFFFFF
Card background:     #FFFFFF
Card border:         #F0F0F0
Text primary:        #1D1D1D
Text description:    #999999
Price:               #1D1D1D
Section heading:     #1D1D1D
Section line:        primary_color
```

**Shared:**
```
Accent:              primary_color (from DB)
Bestseller:          #FF6B00
Veg:                 #0F8A00
Non-veg:             #E23744
Jain:                #F59E0B
```

---

## 4. Typography

```
Playfair Display: 600, 700, 800  -> logo/name, page headings, dish name in detail sheet
Inter: 400, 500, 600, 700, 800  -> everything else
```

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Restaurant name (navbar) | Playfair Display | 22px | 700 | #FFF (view1) / #1D1D1D (view2) |
| Tagline / city | Inter | 10px | 500 | rgba(255,255,255,0.5) (view1) / #999 (view2) |
| Page heading "Food Category You Might Love" | Playfair Display | 20px | 700 | #FFF |
| Category name (on card) | Inter | 15px | 600 | #1D1D1D |
| Back + category title (view 2) | Inter | 16px | 700 | #1D1D1D |
| Section heading | Inter | 16px | 700 | #1D1D1D |
| Dish name | Inter | 16px | 700 | #1D1D1D |
| Dish hindi name | Inter | 12px | 500 | #999 |
| Dish description | Inter | 13px | 400 | #999 |
| Price | Inter | 16px | 700 | #1D1D1D |
| Dish name (detail sheet) | Playfair Display | 24px | 700 | #1D1D1D |
| Badge | Inter | 9px | 800 | #FFF |
| Filter text | Inter | 13px | 600 | #1D1D1D |

---

## 5. VIEW 1 — Category Browser

### 5.1 Navbar (View 1) — VISUALLY DISTINCT BAR

```
Background:     getNavbarBrand(primary_color)  ← slightly lighter than page
Padding:        16px 18px
Border-bottom:  1px solid rgba(255,255,255,0.08)  ← creates visible separation
Layout:         flex row, align center, gap 14
Position:       sticky, top 0, z-index 20
```

The navbar MUST look like a separate bar from the content below. The slight color difference + border creates this distinction.

**Logo + Name — TWO MODES:**

**Mode A — Restaurant has a logo image (logo_url exists):**
- Show logo: 40x40 circle, overflow hidden, object-fit cover, border 1.5px solid rgba(255,255,255,0.15)
- Next to it: restaurant name in Playfair Display, 18px, weight 700, white
- Below name: tagline/city in Inter 10px, weight 500, rgba(255,255,255,0.4), uppercase, letter-spacing 0.12em

**Mode B — Restaurant has NO logo image (logo_url is null):**
- NO circle, NO initial, NO placeholder icon
- Just the restaurant name as styled text: Playfair Display, 22px, weight 700, white
- Below name: tagline/city in Inter 10px, weight 500, rgba(255,255,255,0.4), uppercase, letter-spacing 0.12em
- This is how The Brewery does it — "THE BREWERY" / "Happiness Brewed" as pure text
- The name IS the logo

**RIGHT SIDE — Nothing. No cart icon in the navbar. Cart is only the floating button at bottom-right (section 5.4).**

### 5.2 Category Heading

```
Padding:        28px 16px 16px
Background:     getDarkBrand(primary_color)  ← same as page
```

- Text: "Food Category You Might Love"
- Font: Playfair Display, 20px, weight 700, #FFFFFF
- Left-aligned

### 5.3 Category Grid

```
Padding:        0 12px 120px
Background:     getDarkBrand(primary_color)
display:        grid
grid-template-columns: 1fr 1fr
gap:            12px
```

**Each Category Card:**
```
Background:     #FFFFFF
Border-radius:  16px
Padding:        10px
Cursor:         pointer
Overflow:       hidden
Transition:     transform 0.15s ease
Active:         scale(0.97)
```

**Inside the card:**

1. **Photo area:**
   - Border-radius: 12px
   - Overflow: hidden
   - Aspect-ratio: 1 (square)
   - Background: #F5F5F5
   - Photo source: FIRST dish image from that category (product with image_url not null)
   - If no images: centered food emoji at 36px, opacity 0.25, on #F5F5F5:
     - Breakfast: 🍳, Starters/Appetizers: 🥘, Main Course: 🍛, Breads: 🫓
     - Rice: 🍚, Beverages/Drinks: 🥤, Desserts: 🍰, Shakes: 🥤, Snacks: 🍿, Default: 🍽️
   - Image: object-fit cover

2. **Category name:**
   - Inter, 15px, weight 600, color #1D1D1D
   - Text-align: center
   - Margin-top: 12px
   - Padding-bottom: 6px

3. **Cart badge (if items from this category in cart):**
   - Top-right corner of card
   - Circle 20px, background primary_color, text getContrastText(primary), font 10px weight 800

**Animation:** Staggered fade-in, delay: index * 60ms

### 5.4 Floating Cart Button (View 1 ONLY)

This is the ONLY cart element on View 1. Nothing in the navbar.

```
Position:       fixed, bottom 24px, right 20px, z-index 50
```

- Size: 56x56px, border-radius 14px (rounded square)
- Background: primary_color
- Icon: shopping bag, 24px, color getContrastText(primary_color)
- Shadow: 0 4px 20px rgba(primary, 0.4)
- Item count badge: 20px circle, top-right overlapping, bg #FF6B00, white text, weight 800
- On tap: open CartSheet
- HIDDEN when cart is empty
- Animation: scale bounce on first item added

---

## 6. VIEW 2 — Dish List

### 6.1 Navbar (View 2)

```
Background:     #FFFFFF
Padding:        14px 16px
Border-bottom:  1px solid #F0F0F0
Layout:         flex row, align center, gap 12
Position:       sticky, top 0, z-index 10
```

**Left — Back arrow:**
- ← icon, 20px, color #1D1D1D
- Tap area: 40x40px
- On tap: return to View 1

**Center — Category name:**
- Inter, 16px, weight 700, color #1D1D1D

**Right — Search icon:**
- 🔍 in 40x40 circle, background #F5F5F5, border-radius 50%
- On tap: toggle search bar

### 6.2 Filter Row (View 2)

```
Padding:        12px 16px
Background:     #FFFFFF
Border-bottom:  1px solid #F0F0F0
Layout:         flex row, gap 10
```

**Category dropdown (left):**
- Button: ☰ icon + "Category" text
- Border: 1.5px solid #E0E0E0, border-radius 10px
- Padding: 8px 14px
- Inter 13px weight 600, color #1D1D1D
- Tap: dropdown of all categories, switch without returning to View 1

**Diet filter dropdown (right):**
- "All ▼" button, same style
- Options: All, Veg, Non-Veg, Jain

### 6.3 Section Heading

```
Padding:        16px 16px 8px
Layout:         flex row, align center
```

- Section name: Inter 16px weight 700, #1D1D1D
- Colored line: flex 1, height 1.5px, background primary_color, margin-left 10px, margin-right 10px
- Collapse arrow: ∧/∨, 20px, color #999

### 6.4 Dish Card (Full-Width Vertical Stack)

**IMPORTANT: Full-width cards, NOT 2-column grid.**

```
Background:     #FFFFFF
Margin:         0 16px 16px
Border-radius:  16px
Border:         1px solid #F0F0F0
Overflow:       hidden
Cursor:         pointer
```

**Inside each card:**

1. **Photo (top):**
   - Margin: 12px 12px 0
   - Aspect-ratio: 4/3 (landscape)
   - Border-radius: 12px
   - If image: object-fit cover
   - If NO image: skip photo entirely. No placeholder. Card starts with text.

2. **Content (below photo):**
   - Padding: 14px 14px 16px

   **Row 1 — Veg badge + Name:**
   - Veg SVG 16x16 + dish name Inter 16px weight 700 #1D1D1D
   - If bestseller: 🔥 emoji or "#1 Most liked" badge (#FF6B00 bg, white text)

   **Row 2 — Hindi name (if exists):**
   - Inter 12px weight 500, #999

   **Row 3 — Description (if exists):**
   - Inter 13px weight 400, #999, max 2 lines ellipsis

   **Row 4 — Price + spice:**
   - "₹XXX" Inter 16px weight 700, #1D1D1D
   - Chili emojis if spice > 0

3. **Add button:**
   - Position: absolute, right 14px, bottom 14px
   - 44x44 circle, background primary_color, icon + in getContrastText(primary)
   - Shadow: 0 2px 10px rgba(0,0,0,0.15)
   - When qty > 0: count badge on button (circle, #FF6B00 bg, white text)

**Unavailable dish:** opacity 0.4, add button hidden, "Currently Unavailable" in #E23744

**Card tap → Dish Detail Bottom Sheet**

### 6.5 Dish Detail Bottom Sheet

**Overlay:**
```css
position: fixed;
inset: 0;
z-index: 100;
background: rgba(0, 0, 0, 0.5);
display: flex;             /* centers sheet horizontally */
align-items: flex-end;
justify-content: center;
```

**Sheet:**
```css
width: 100%;
max-width: 420px;
background: #FFFFFF;
border-radius: 20px 20px 0 0;
max-height: 80vh;
overflow-y: auto;
box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
animation: sheetUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
```

```css
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
/* ONLY translateY. Flex handles horizontal centering. */
```

**Handle:** 36x4px centered, #E0E0E0, border-radius 4px

**Content (16px 20px 28px):**
1. Photo (if exists): full width, 16/10, border-radius 14px
2. Badges: veg SVG + "#N Most liked" (#FF6B00) + "JAIN" (#F59E0B)
3. Name: Playfair Display 24px weight 700, #1D1D1D
4. Hindi name: Inter 14px, #999
5. Price: Inter 20px weight 800, #1D1D1D + chili emojis
6. Description: Inter 14px weight 400, #666, line-height 1.6
7. Divider: 1px solid #F0F0F0
8. Qty control [−1+] + "Add to order · ₹XXX" button (bg primary_color, text getContrastText)

### 6.6 Cart Bar (View 2 ONLY — full-width bar)

```
Position:       fixed, bottom 0, z-index 50
Max-width:      420px, centered
Padding:        8px 16px 16px
```

- Frost: linear-gradient(to top, rgba(255,255,255,0.95) 60%, transparent)
- Bar: bg primary_color, text getContrastText(primary), border-radius 14px, padding 14px 20px
- Shadow: 0 4px 20px rgba(primary, 0.3)
- Left: count badge + "View Cart"
- Right: "₹XXX"
- Spring bounce animation
- Hidden when empty

---

## 7. Animations

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideOutLeft {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-30px); }
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes cartBounce {
  0% { transform: translateY(100%); }
  60% { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}
```

---

## 8. Edge Cases

- **Category with 0 available dishes**: hide from grid
- **Category with no dish images**: emoji placeholder on card
- **Dish with no image**: skip photo, text-only card (still full-width)
- **Restaurant with no logo**: show text-only name in Playfair Display (no circle, no initial)
- **Light primary_color (cream, yellow)**: getDarkBrand still creates a usable dark bg, getContrastText handles text
- **Very light primary_color**: navbar and page bg will be a very subtle dark tint — still works
- **Single dish in category**: full-width card, no issues
- **Long names**: 2 lines max with ellipsis in cards, full text in sheet

---

## 9. What NOT to Do

- ❌ NO hardcoded #000000 for page background — use getDarkBrand(primary_color)
- ❌ NO cart icon in the navbar — only floating bag button (View 1) or full bar (View 2)
- ❌ NO TWO cart elements visible at once — one per view
- ❌ NO circle/initial placeholder for text-only logos — just the name in Playfair Display
- ❌ NO 2-column grid for dishes — full-width vertical cards only
- ❌ NO dark background in View 2 — white only
- ❌ NO sticky category tabs — use back button + dropdown
- ❌ NO pill-shaped filters — rectangular bordered buttons
- ❌ NO hardcoded text on primary bg — ALWAYS getContrastText()
- ❌ NO translateX in bottom sheet
- ❌ NO separate CSS files

---

## 10. What TO Do

- ✅ Brand-adaptive dark backgrounds via getDarkBrand() and getNavbarBrand()
- ✅ Visually distinct navbar (lighter) from page (darker) with border
- ✅ Text-only logo when no image — name in Playfair Display serif
- ✅ ONE cart element per view (floating bag on View 1, full bar on View 2)
- ✅ White cards on brand-dark background
- ✅ Full-width vertical dish cards with landscape photos
- ✅ Collapsible section headings with primary_color line
- ✅ Category dropdown + diet filter in View 2
- ✅ Smooth slide transitions between views
- ✅ Bottom sheet for dish details (flex-centered, translateY only)
- ✅ Playfair Display for headings, Inter for body
- ✅ getContrastText() and getSafeAccent() everywhere
- ✅ #FF6B00 for bestseller badges (fixed, never brand color)
- ✅ Staggered fade-in animations

---

## 11. Files to Create

```
src/lib/utils.ts                         <- ADD getContrastText, getSafeAccent, getDarkBrand, getNavbarBrand

src/components/menu/
  MenuHeader.tsx                          <- navbar: adapts to both views, text-only logo support
  CategoryBrowser.tsx                     <- View 1: brand-dark bg, 2-column category grid
  CategoryCard.tsx                        <- white card with photo + name
  DishListView.tsx                        <- View 2: white bg, back button, filters, dish stack
  DishCard.tsx                            <- full-width card with landscape photo + info
  DishDetailSheet.tsx                     <- centered bottom sheet
  FilterRow.tsx                           <- category dropdown + diet filter
  SectionHeading.tsx                      <- heading with colored line + collapse
  CartBar.tsx                             <- floating bag (View 1) + full bar (View 2)
  CartSheet.tsx                           <- keep existing cart panel

src/app/[slug]/CustomerMenu.tsx           <- state router: View 1 or View 2
```

---

## 12. State Architecture

```typescript
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [dietFilter, setDietFilter] = useState<DietFilter>('all');
const [searchOpen, setSearchOpen] = useState(false);
const [search, setSearch] = useState('');
const [selectedDish, setSelectedDish] = useState<Product | null>(null);
const [cartOpen, setCartOpen] = useState(false);

// View 1: selectedCategory === null  → show CategoryBrowser
// View 2: selectedCategory === id    → show DishListView
```
