# DESIGN.md — Customer Menu UI Specification

> This document defines the visual design for the customer-facing menu page.
> Claude Code: follow this exactly. Do not deviate without asking.

---

## 1. Design Philosophy

The menu should feel like **the restaurant's logo came alive as a digital experience**. Every restaurant gets a unique atmosphere driven by their `primary_color` and `secondary_color`. Two restaurants with different brand colors should feel like two completely different apps.

**Reference:** UNI Boston's online ordering page — dark, premium, food-forward, with "#1 Most liked" badges and a 2-column grid of dishes.

**Vibe:** Walking into a beautifully lit restaurant at night. Premium but not pretentious. The food is the hero.

---

## 2. Color System

The entire page is themed from two database fields: `primary_color` and `secondary_color`.

```
Page background:       #000000 (pure black)
Card backgrounds:      #111111 or rgba(primary, 0.04)
Text primary:          #FFFFFF
Text secondary:        #999999
Text muted:            #555555
Accent / CTAs:         primary_color (from database)
Header background:     secondary_color (from database)
Borders/dividers:      rgba(255,255,255,0.06)
```

### Dynamic Brand Usage
- **Accent stripe** at top of header: `primary_color`
- **Active category tab**: `primary_color` bottom border
- **Active filter pill**: `primary_color` background
- **ADD button border**: `primary_color`
- **Price text**: `primary_color`
- **"Most liked" badge**: `primary_color` background
- **Cart bar**: `primary_color` background with glow `boxShadow: 0 4px 24px rgba(primary, 0.5)`
- **Logo circle glow**: `boxShadow: 0 0 20px rgba(primary, 0.3)`
- **No-image placeholder gradient**: subtle `rgba(primary, 0.08)` tint

---

## 3. Typography

Import from Google Fonts in `layout.tsx`:

```
Cormorant Garamond: weights 500, 600, 700  → headers, restaurant name, category names
Inter: weights 400, 500, 600, 700, 800     → body text, prices, buttons, UI
```

### Usage
| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Restaurant name | Cormorant Garamond | 20px | 700 | white |
| Category heading | Cormorant Garamond | 22px | 600 | white |
| Dish name (in grid) | Inter | 14px | 700 | white |
| Dish name (in sheet) | Cormorant Garamond | 24px | 700 | white |
| Hindi name | Inter | 10-11px | 500 | #555 |
| Price (in grid) | Inter | 14px | 700 | #999 |
| Price (in sheet) | Inter | 22px | 800 | primary_color |
| Description | Inter | 12-14px | 400 | #777 |
| Badge text | Inter | 9-10px | 800 | white or primary |
| Button text | Inter | 13px | 800 | white or primary |

---

## 4. Page Layout — Mobile First (max-width: 420px)

```
┌──────────────────────────┐
│  HEADER                  │  ← dark bg, logo + name side by side
│  ─ accent stripe ─       │  ← thin brand color line
├──────────────────────────┤
│  CATEGORY TABS (sticky)  │  ← underline style, horizontally scrollable
│  FILTERS + SEARCH        │  ← one row: diet pills + search input
├──────────────────────────┤
│                          │
│  CATEGORY HEADING        │  ← big serif text
│  ┌─────┐  ┌─────┐       │
│  │DISH │  │DISH │       │  ← 2-column grid
│  │CARD │  │CARD │       │
│  └─────┘  └─────┘       │
│  ┌─────┐  ┌─────┐       │
│  │DISH │  │DISH │       │
│  │CARD │  │CARD │       │
│  └─────┘  └─────┘       │
│                          │
│  CATEGORY HEADING        │
│  ┌─────┐  ┌─────┐       │
│  │ ... │  │ ... │       │
│                          │
├──────────────────────────┤
│  CART BAR (fixed bottom) │  ← brand color, count badge, total
└──────────────────────────┘

TAP DISH → BOTTOM SHEET slides up:
┌──────────────────────────┐
│  ── handle bar ──        │
│  [veg] [#1 Most liked]   │
│  Dish Name (serif)       │
│  dish hindi name         │
│  ₹250  🌶️🌶️             │
│  Description text...     │
│  ────────────────────    │
│  [−] [1] [+]   [Add to order · ₹250] │
└──────────────────────────┘
```

---

## 5. Component Specifications

### 5.1 Header

```
Background:        secondary_color (dark)
Layout:            flex row — logo left, name + city right
Height:            auto, padding 20px 18px 16px
Top accent:        3px tall bar, gradient from primary_color to transparent
```

- **Logo circle**: 44x44px, rounded full, gradient of `primary_color`, border `1.5px solid rgba(primary, 0.4)`, box-shadow glow `0 0 20px rgba(primary, 0.3)`. If no logo image, show first letter of restaurant name in white, weight 800.
- **Restaurant name**: 17px, weight 800, white, `letter-spacing: -0.2px`
- **City + timings**: 10px, weight 600, color `#666`, `letter-spacing: 0.05em`
- **Brand underline below name area**: 2px height, 60% width, gradient from `primary_color` to transparent

### 5.2 Category Tabs (sticky)

```
Container:         sticky top:0, z-index:10
Background:        rgba(0,0,0,0.9) with backdrop-filter: blur(20px)
Border bottom:     1px solid #1a1a1a
Scroll:            horizontal, hide scrollbar, -webkit-overflow-scrolling: touch
```

- **Tab style**: NOT pills. Plain text buttons.
- **Active tab**: white text, weight 800, `border-bottom: 2px solid primary_color`
- **Inactive tab**: color `#555`, weight 500, `border-bottom: 2px solid transparent`
- **Font size**: 13px
- **Padding per tab**: 6px 16px

### 5.3 Diet Filters + Search (one row)

```
Layout:            flex row — filter pills on left, search input takes remaining space
Padding:           0 14px 10px
Gap:               8px
```

**Filter pills:**
- Active: `background: primary_color`, color white, no border
- Inactive: `background: transparent`, `border: 1px solid rgba(primary, 0.15)`, color `#666`
- Veg pill shows a small green dot (●) before text
- Size: `padding: 4px 10px`, font 11px, weight 700, border-radius 6px

**Search input:**
- Background: `rgba(primary, 0.04)` or `rgba(0,0,0,0.03)`
- Border: `1px solid rgba(0,0,0,0.08)`, on focus `rgba(primary, 0.3)`
- Border-radius: 8px
- Padding: 7px 12px 7px 28px (icon space on left)
- Font: 12px weight 500
- 🔍 emoji as search icon (position absolute, left 10px, opacity 0.35)
- Clear button (✕): small circle, `background: rgba(primary, 0.12)`, color primary

### 5.4 Dish Card (2-Column Grid)

```
Grid:              display: grid, grid-template-columns: 1fr 1fr, gap: 10px
Card padding:      0 (image fills the square)
Text area:         padding: 10px 4px 0 (below the square)
```

**The square card area:**
- `aspect-ratio: 1` (perfect square)
- `border-radius: 14px`
- `overflow: hidden`
- Background: `linear-gradient(145deg, #1a1a1a, #111)`

**If dish HAS an image:**
- Image fills the entire square with `object-fit: cover`
- Overlay badges + button on top of image

**If dish has NO image (most common case):**
- Show an elegant branded placeholder:
  - Background: `linear-gradient(145deg, rgba(primary, 0.08), #0a0a0a 60%, rgba(primary, 0.04))`
  - Subtle dot pattern: `radial-gradient(circle, primary 1px, transparent 1px)` at 3% opacity, size 16px
  - Centered: a thin ring (52x52, border `1.5px solid rgba(primary, 0.2)`) with the dish's first letter inside (22px, weight 800, color `rgba(primary, 0.4)`)
  - Below the ring: small "PURE VEG" text in `rgba(primary, 0.25)`, 9px, uppercase, letter-spacing 0.1em

**Overlays on the square:**

1. **"#N Most liked" badge** (top-left, only for top 3 dishes by order_count):
   - `padding: 3px 8px`, `border-radius: 6px`
   - Background: `primary_color`
   - Color: white, font 10px, weight 800
   - Box-shadow: `0 2px 8px rgba(primary, 0.4)`
   - Text: "#1 Most liked", "#2 Most liked", "#3 Most liked"

2. **Veg badge** (top-right):
   - Standard Indian veg symbol: 14x14 SVG square with green stroke + green circle
   - Background of the square: `rgba(0,0,0,0.5)` for contrast on images

3. **"+" button** (bottom-right):
   - 36x36px circle
   - Background: `rgba(0,0,0,0.75)`, border: `1px solid #333`
   - `backdrop-filter: blur(8px)`
   - Color: white, font 20px, weight 500
   - On hover: background becomes `primary_color`, border matches
   - When qty > 0: morphs into `[− qty +]` horizontal pill with rounded ends

4. **SOLD OUT overlay** (full card, only if `is_available === false`):
   - `background: rgba(0,0,0,0.6)`, centered text "SOLD OUT" in #999, 11px, weight 800

**Below the square (text area):**
- Dish name: 14px, weight 700, white, line-height 1.3
- Hindi name: 10px, weight 500, color #555, margin-top 1px
- Price row: `₹XX` in 14px weight 700 color #999 + chili emojis for spice level
- Margin-top on price: 4px

### 5.5 Bottom Sheet (Dish Detail)

Triggered when user taps a dish card.

```
Overlay:           position fixed, inset 0, background rgba(0,0,0,0.7)
Sheet:             slides up from bottom (animation: translateY 100% → 0%)
                   max-width 420px, border-radius 20px 20px 0 0
                   background #111, border 1px solid #222
                   max-height 70vh, overflow auto
```

**Handle bar:** 32x4px, centered, background #333, border-radius 4px, padding 10px 0 4px

**Content (padding 8px 22px 28px):**
1. Badge row: veg SVG + "Most liked" badge + JAIN badge
2. Dish name: Cormorant Garamond, 24px, weight 700, white
3. Hindi name: 13px, color #555
4. Price: 22px, weight 800, `primary_color` + spice emojis
5. Description: 14px, color #777, line-height 1.65
6. Divider: 1px solid #222
7. Action row:
   - Qty control: `[−] [count] [+]` with border `1.5px solid #333`, background #1a1a1a per button
   - "Add to order · ₹XXX" button: flex 1, padding 14px, border-radius 10px, background `primary_color`, box-shadow glow, white text 15px weight 700

### 5.6 Cart Bar (Fixed Bottom)

```
Position:          fixed bottom 0, z-index 50
Container padding: 6px 14px 16px
```

- **Frost backdrop**: gradient from `rgba(0,0,0,0.95)` to transparent, pointing upward
- **Bar**: flex row, justify between, padding 14px 18px, border-radius 14px
- **Background**: `primary_color`
- **Box-shadow**: `0 4px 24px rgba(primary, 0.5), 0 0 0 1px rgba(primary, 0.3)`
- **Left side**: count badge (28px circle, `rgba(255,255,255,0.2)` bg, white text, 12px weight 900) + "View Cart" text (14px weight 700)
- **Right side**: total `₹XXX` (16px weight 800)
- **Animation on first appearance**: spring bounce (translateY 100% → overshoot -5px → settle 0)
- **Hidden when cart is empty**

---

## 6. Animations

```css
/* Dish cards fade in with stagger */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Apply with delay: animation-delay: (index * 50ms) */

/* Bottom sheet slide up */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
/* Timing: 0.32s cubic-bezier(0.32, 0.72, 0, 1) */

/* Cart bar bounce in */
@keyframes cartPop {
  0%   { transform: translateY(100%); }
  60%  { transform: translateY(-5px); }
  100% { transform: translateY(0); }
}
/* Timing: 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) */

/* Popular dish glow pulse (left accent bar) */
@keyframes glow {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```

---

## 7. Responsive Notes

- **Max-width**: 420px, centered with `margin: 0 auto`
- **Mobile-first**: everything designed for 360px minimum
- **Touch targets**: minimum 36px for all tappable elements
- **Grid gap**: 10px between cards in 2-column grid
- **Category tabs**: horizontal scroll with `-webkit-overflow-scrolling: touch`
- **Hide scrollbars**: all scrollable areas use `scrollbar-width: none` and `::-webkit-scrollbar { display: none }`

---

## 8. What NOT to Do

- ❌ No white or light backgrounds — the page is DARK
- ❌ No card shadows or borders on dish cards — they float on black
- ❌ No rounded pill-shaped category tabs — use underline style
- ❌ No placeholder images or grey boxes for missing dish photos — use the branded initial placeholder
- ❌ No descriptions shown in the grid cards — only in the bottom sheet on tap
- ❌ No generic fonts — use Cormorant Garamond for headers, Inter for body
- ❌ No hardcoded colors — everything derives from restaurant's primary_color and secondary_color
- ❌ No color picker — that was for demo only
- ❌ Don't remove any existing functionality (cart, filters, search, Supabase, real-time)
- ❌ Don't make separate CSS files — keep styles inline or in the component

---

## 9. Files to Modify

```
src/components/menu/MenuHeader.tsx      ← dark header, logo + name side by side
src/components/menu/CategoryTabs.tsx    ← underline-style tabs, dark bg
src/components/menu/FilterBar.tsx       ← compact pills, merge with search row
src/components/menu/SearchBar.tsx       ← dark input, compact
src/components/menu/DishCard.tsx        ← 2-column grid card with square image area
src/components/menu/CartSheet.tsx       ← brand color cart bar
src/app/[slug]/CustomerMenu.tsx         ← black page bg, grid layout, add DishDetailSheet
```

**New component to create:**
```
src/components/menu/DishDetailSheet.tsx  ← bottom sheet overlay with full dish details
```

---

## 10. Reference Code

The complete working preview is in `menu_final.jsx`. Use it as the source of truth for:
- Exact color values and opacity levels
- Animation timings and easing curves
- Component structure and layout
- How the no-image placeholder looks
- How the "Most liked" ranking works
- How the bottom sheet behaves
- How the cart bar appears and animates

Translate the preview's inline styles into the existing Tailwind + shadcn component structure. Keep all Supabase data fetching, Zustand cart, and real-time functionality intact.
