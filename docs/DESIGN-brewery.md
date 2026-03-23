# DESIGN-dark.md — The Brewery Theme

> Claude Code: DELETE all existing menu components and rebuild from scratch.
> This is a two-view category-first menu. Follow every detail exactly.

---

## 1. Overview

This menu has TWO VIEWS — not a single scrolling page:

**View 1 — Category Browser (landing)**
Black background. White cards in a 2-column grid. Each card has a large food photo + category name. Customer taps a category to enter it.

**View 2 — Dish List (inside a category)**
White background. Full-width dish cards stacked vertically. Each card has a big photo on top, dish info below. Back button returns to View 1.

This is managed with React state — NOT separate routes. A single page component with `selectedCategory` state. When null = View 1, when set = View 2.

---

## 2. Contrast Utilities

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
```

---

## 3. Colors

**View 1 (Category Browser):**
```
Page background:     #000000
Card background:     #FFFFFF
Card text:           #1D1D1D
Heading text:        #FFFFFF
```

**View 2 (Dish List):**
```
Page background:     #FFFFFF
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
Playfair Display: 600, 700, 800  -> logo, headings, dish name in sheet
Inter: 400, 500, 600, 700, 800  -> everything else
```

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Restaurant name (header) | Playfair Display | 20px | 700 | #FFF (view1) or #1D1D1D (view2) |
| "Happiness Brewed" tagline | Inter | 10px | 500 | #999 |
| Page heading "Food Category You Might Love" | Playfair Display | 20px | 700 | #FFF |
| Category name (on card) | Inter | 15px | 600 | #1D1D1D |
| Back button + category title (view 2) | Inter | 16px | 700 | #1D1D1D |
| Section heading (collapsible) | Inter | 16px | 700 | #1D1D1D |
| Dish name | Inter | 16px | 700 | #1D1D1D |
| Dish hindi name | Inter | 12px | 500 | #999 |
| Dish description | Inter | 13px | 400 | #999 |
| Price | Inter | 16px | 700 | #1D1D1D |
| "Customization available" | Inter | 12px | 500 | #999 |
| Dish name (in detail sheet) | Playfair Display | 24px | 700 | #1D1D1D |
| Badge | Inter | 9px | 800 | #FFF |
| Filter text | Inter | 13px | 600 | #1D1D1D |

---

## 5. VIEW 1 — Category Browser

### 5.1 Header (View 1)

```
Background:     #000000
Padding:        18px 16px
Layout:         flex row, space-between, align center
```

**Left — Logo + Name:**
- Logo: if image exists, show 40x40 circle image. If no image, skip — just show text.
- Restaurant name: Playfair Display, 20px, weight 700, white
- Tagline below name (optional): Inter 10px weight 500, #999, letter-spacing 0.15em, uppercase. Like "Happiness Brewed"

**Right — Cart icon:**
- If cart has items: show a shopping bag icon (24x24) inside a 44x44 rounded-square button
- Button: border 1.5px solid #FFF, border-radius 12px, background transparent
- Badge: primary_color circle overlapping top-right corner, 18px, getContrastText text, item count

**No sign-in button — we don't need it. No search here.**

### 5.2 Category Heading

```
Padding:        28px 16px 16px
```

- Text: "Food Category You Might Love" — or dynamically: "Our Menu" or "What are you craving?"
- Font: Playfair Display, 20px, weight 700, #FFFFFF
- Left-aligned, no subtext

### 5.3 Category Grid

```
Padding:        0 12px 120px (bottom padding for cart bar space)
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
   - Background: #F5F5F5 (fallback if no image)
   - Photo source: use the FIRST dish image from that category. Query products where category_id matches and image_url is not null, take the first one.
   - If no dish in that category has an image: show a centered food emoji related to the category name at 36px, opacity 0.25, on #F5F5F5 background. Fallback emoji map:
     - Breakfast/Starters/Appetizers: 🍳
     - Main Course/Mains: 🍛
     - Breads/Roti: 🫓
     - Rice/Biryani: 🍚
     - Beverages/Drinks: 🥤
     - Desserts/Sweet: 🍰
     - Shakes: 🥤
     - Snacks: 🍿
     - Default: 🍽️
   - Image: object-fit cover, fills the square completely

2. **Category name:**
   - Below photo
   - Inter, 15px, weight 600, color #1D1D1D
   - Text-align: center
   - Margin-top: 12px
   - Padding-bottom: 6px

**If cart has items from this category:** show a small dot or count badge at top-right corner of the card. Circle 20px, background primary_color, text getContrastText(primary), font 10px weight 800.

**Animation:** Cards fade in with stagger on page load:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
/* animation-delay: index * 60ms */
```

---

## 6. VIEW 2 — Dish List (Inside a Category)

When user taps a category card, transition to View 2. Use a smooth crossfade or slide animation.

### 6.1 Header (View 2)

```
Background:     #FFFFFF
Padding:        14px 16px
Border-bottom:  1px solid #F0F0F0
Layout:         flex row, align center, gap 12
Position:       sticky, top 0, z-index 10
```

**Left — Back arrow:**
- Icon: ← (left arrow), 20px, color #1D1D1D
- Tap area: 40x40px minimum
- On tap: set selectedCategory to null (return to View 1)

**Center — Category name:**
- Inter, 16px, weight 700, color #1D1D1D
- Centered or left-aligned after the arrow

**Right — Search icon:**
- 🔍 icon inside a 40x40 circle, background #F5F5F5, border-radius 50%
- On tap: toggle search bar below header

### 6.2 Filter Row (View 2)

```
Padding:        12px 16px
Background:     #FFFFFF
Border-bottom:  1px solid #F0F0F0
Layout:         flex row, gap 10, align center
```

**Category dropdown (left):**
- Button with icon ☰ + "Category" text
- Border: 1.5px solid #E0E0E0, border-radius 10px
- Padding: 8px 14px
- Font: Inter 13px weight 600, color #1D1D1D
- On tap: show a dropdown/bottom-sheet listing all categories. Tapping one switches to that category without going back to View 1.

**Filter dropdown (right):**
- "All" with a down chevron ▼
- Same style as category button
- Options: All, Veg, Non-Veg, Jain
- On tap: filter dishes

### 6.3 Section Heading (Collapsible)

Each category view can have sub-sections, but for simplicity treat the whole category as one section.

```
Padding:        16px 16px 8px
Layout:         flex row, align center
```

- **Section name**: Inter 16px weight 700, color #1D1D1D
- **Line**: flex 1, height 1.5px, background primary_color, margin-left 10px, margin-right 10px. This is the colored line extending from the heading to the right — signature Brewery style.
- **Collapse arrow**: ∧ or ∨ icon, 20px, color #999. Tapping collapses/expands the section's dishes.

### 6.4 Dish Card (Full-Width, Vertical Stack)

```
Background:     #FFFFFF
Margin:         0 16px 16px
Border-radius:  16px
Border:         1px solid #F0F0F0
Overflow:       hidden
Cursor:         pointer
```

**IMPORTANT: These are full-width cards stacked vertically, NOT a 2-column grid. Each dish gets its own big card.**

**Inside each card:**

1. **Photo area (top):**
   - Width: 100% of card (edge to edge minus padding)
   - Margin: 12px 12px 0 12px (padded inside card, with rounded corners)
   - Aspect-ratio: 4/3 (landscape, NOT square — wider than tall)
   - Border-radius: 12px
   - Overflow: hidden
   - Background: #F5F5F5
   - If dish has image: object-fit cover
   - If no image: DO NOT show photo area at all. Card starts directly with the text content. No grey box, no placeholder.

2. **Content area (below photo):**
   - Padding: 14px 14px 16px

   **Row 1 — Veg badge + Dish name:**
   - Layout: flex row, align start, gap 8
   - Veg/Non-veg badge: standard Indian 16x16 SVG (green square+circle for veg, red for non-veg)
   - Dish name: Inter 16px weight 700, color #1D1D1D
   - If bestseller (top 3 by order_count): show 🔥 emoji before name, or small "#1 Most liked" badge in #FF6B00

   **Row 2 — Hindi name (optional):**
   - Inter 12px weight 500, color #999
   - Only if name_hindi exists

   **Row 3 — Description:**
   - Inter 13px weight 400, color #999
   - Max 2 lines with ellipsis
   - Only if description exists

   **Row 4 — Price + extras:**
   - Layout: flex row, align center, justify space-between
   - Left: "₹ XXX.XX" — Inter 16px weight 700, color #1D1D1D
   - Below price (optional): "Customization available" in Inter 12px weight 500, #999 — skip this for now, future feature
   - Right: Spice indicators 🌶️ if spice > 0

3. **Action buttons (right side, floating):**
   - Positioned absolute, right 14px, bottom 14px
   - **Add button**: 44x44 circle, background primary_color, icon: shopping bag or + in getContrastText(primary), box-shadow 0 2px 10px rgba(0,0,0,0.15)
   - When qty > 0: show count badge on the button (small circle top-right, #FF6B00 bg, white text, count number)

**Card tap → opens Dish Detail Bottom Sheet**

**If dish is unavailable (is_available === false):**
- Entire card opacity 0.4
- Add button hidden
- Show "Currently Unavailable" text in #E23744, Inter 12px weight 600, below price

**Animation:** Cards fade in staggered:
```css
animation: fadeIn 0.3s ease both;
animation-delay: calc(index * 50ms);
```

### 6.5 Dish Detail Bottom Sheet

Opens when user taps a dish card in View 2.

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
  to { transform: translateY(0); }
}
/* ONLY translateY — flex handles horizontal centering */
```

**Handle bar:** 36x4px, centered, background #E0E0E0, border-radius 4px, margin 10px auto 8px

**Content (padding 16px 20px 28px):**

1. **Photo** (if dish has image):
   - Full width, aspect-ratio 16/10, border-radius 14px, overflow hidden, margin-bottom 16px
   - object-fit cover

2. **Badges row** (flex, gap 6):
   - Veg SVG 18x18
   - "#N Most liked" badge: bg #FF6B00, white text, 10px weight 800, padding 3px 10px, border-radius 6px
   - "JAIN" badge: bg rgba(245,158,11,0.12), color #F59E0B, 10px weight 800

3. **Dish name**: Playfair Display, 24px, weight 700, #1D1D1D, margin-top 10px
4. **Hindi name**: Inter 14px, weight 500, #999, margin-top 2px
5. **Price + spice** (margin-top 10px):
   - Price: Inter 20px weight 800, #1D1D1D
   - Spice: chili emojis at 14px

6. **Description** (margin-top 12px):
   - Inter 14px weight 400, #666, line-height 1.6
   - Full text, no line clamp

7. **Divider**: 1px solid #F0F0F0, margin 20px 0

8. **Action row** (flex, gap 12, align center):
   - **Qty control**: border 1.5px solid #E0E0E0, border-radius 12px, overflow hidden
     - − button: 44x44, background #F8F8F8, color #666, font 18px weight 700
     - Count: 40px center, Inter 16px weight 800, #1D1D1D
     - + button: same as minus
   - **"Add to order" button**: flex 1, padding 14px, border-radius 12px
     - Background: primary_color
     - Color: getContrastText(primary_color)
     - Font: Inter 15px weight 700
     - Shadow: 0 4px 16px rgba(primary, 0.25)
     - Text: "Add to order · ₹XXX"

**Overlay click → close. Sheet click → stopPropagation.**

### 6.6 Cart Bar (Fixed Bottom — Both Views)

Visible on BOTH View 1 and View 2 when cart has items.

**View 1 (black bg) — Floating bag icon:**
```
Position:       fixed, bottom 20px, right 16px, z-index 50
```
- 56x56 rounded-square (border-radius 14px)
- Background: primary_color
- Icon: shopping bag, color getContrastText(primary), 24px
- Shadow: 0 4px 20px rgba(primary, 0.4)
- Badge: item count in small 20px circle, top-right, bg #FF6B00, white text, weight 800
- On tap: open CartSheet

**View 2 (white bg) — Full-width bar:**
```
Position:       fixed, bottom 0, z-index 50
Max-width:      420px, centered
Padding:        8px 16px 16px
```
- Frost backdrop: linear-gradient(to top, rgba(255,255,255,0.95) 60%, transparent)
- Bar: flex row, justify between, padding 14px 20px, border-radius 14px
- Background: primary_color
- Color: getContrastText(primary_color)
- Shadow: 0 4px 20px rgba(primary, 0.3)
- Left: count badge (24px circle, rgba(0,0,0,0.15) bg) + "View Cart" 14px weight 700
- Right: "₹XXX" 16px weight 800
- Animation: slide up with spring bounce on first item

---

## 7. Animations

```css
/* Cards fade in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* View transition */
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideOutLeft {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-30px); }
}

/* Bottom sheet */
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Cart bar bounce */
@keyframes cartBounce {
  0% { transform: translateY(100%); }
  60% { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}
```

**View transition:** When tapping a category, View 1 slides left + fades out, View 2 slides in from right. When tapping back, reverse. Use React state + CSS transitions.

---

## 8. Edge Cases

- **Category with 0 available dishes**: hide it from the grid entirely
- **Category with no dish images**: show emoji placeholder on category card
- **Dish with no image**: skip photo area in dish card, start with text directly. Card is shorter but still full-width.
- **Dish with no description**: skip description row, card is tighter
- **Light primary_color**: getContrastText returns dark text, getSafeAccent darkens it
- **Single dish in category**: still full-width card, no layout issues
- **Long category name**: max 2 lines with ellipsis on category card
- **Long dish name**: max 2 lines in card, full text in sheet

---

## 9. What NOT to Do

- ❌ NO 2-column grid for dishes — dishes are FULL-WIDTH vertical cards
- ❌ NO dark background in View 2 — dish list is WHITE
- ❌ NO sticky category tabs in View 2 — use back button + category dropdown instead
- ❌ NO inline descriptions in the category browser — only category names
- ❌ NO pill-shaped filter buttons — use bordered rectangular buttons with dropdowns
- ❌ NO serif fonts for dish names in cards — only Playfair Display for the header logo, page heading, and dish name in the detail sheet
- ❌ NO hardcoded text colors on primary bg — ALWAYS getContrastText()
- ❌ NO translateX in bottom sheet animation
- ❌ NO removing cart/filter/Supabase functionality
- ❌ NO separate CSS files — Tailwind or inline styles only

---

## 10. What TO Do

- ✅ TWO-VIEW architecture: category grid (black) → dish list (white)
- ✅ White cards on black background for category browser
- ✅ Full-width vertical dish cards with big landscape photos
- ✅ Collapsible section headings with primary_color line
- ✅ Category dropdown + diet filter dropdown in View 2
- ✅ Floating shopping bag button on View 1
- ✅ Full-width cart bar on View 2
- ✅ Smooth slide transitions between views
- ✅ Bottom sheet for dish details with photo + full info
- ✅ Playfair Display for premium headings
- ✅ getContrastText() and getSafeAccent() everywhere
- ✅ Standard Indian veg/non-veg badges
- ✅ Fixed #FF6B00 for bestseller badges
- ✅ Staggered fade-in animations on cards

---

## 11. Files to Create (from scratch)

```
src/lib/utils.ts                         <- ADD getContrastText() and getSafeAccent()

src/components/menu/
  MenuHeader.tsx                          <- logo + name + cart icon (adapts to both views)
  CategoryBrowser.tsx                     <- View 1: 2-column category grid on black bg
  CategoryCard.tsx                        <- white card with photo + category name
  DishListView.tsx                        <- View 2: white bg, back button, filters, dish list
  DishCard.tsx                            <- full-width card with big photo + info
  DishDetailSheet.tsx                     <- bottom sheet with full dish details
  FilterRow.tsx                           <- category dropdown + diet filter dropdown
  SectionHeading.tsx                      <- collapsible heading with colored line
  CartBar.tsx                             <- floating bag (View 1) + full bar (View 2)
  CartSheet.tsx                           <- existing cart slide-up panel (keep)

src/app/[slug]/CustomerMenu.tsx           <- state router: selectedCategory ? DishListView : CategoryBrowser
```

---

## 12. State Architecture

```typescript
// CustomerMenu.tsx
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [dietFilter, setDietFilter] = useState<DietFilter>('all');
const [searchOpen, setSearchOpen] = useState(false);
const [search, setSearch] = useState('');
const [selectedDish, setSelectedDish] = useState<Product | null>(null);
const [cartOpen, setCartOpen] = useState(false);

// View 1: selectedCategory === null
// View 2: selectedCategory === category.id

// Shared: cart (Zustand), products, categories, restaurant from props
```
