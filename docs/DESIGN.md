# Design System: Artisanal Energy

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Kinetic Editorial."** 

We are moving away from the static, boxy layouts of traditional web design. This system captures the energy of a bustling high-end café—vibrant, aromatic, and deeply intentional. By blending high-contrast serif typography with an "Organic Minimalist" layout, we create a digital experience that feels as tactile as a letterpress menu and as warm as a fresh pour-over.

To achieve this, the system rejects standard grids in favor of **intentional asymmetry**. Layouts should feature overlapping elements, generous "breathing room" (negative space), and large-scale typography that breaks the container. The goal is to make every screen feel like a curated magazine spread rather than a software interface.

---

## 2. Colors & Surface Philosophy
The palette is built on the interplay between the "Terracotta" (Logo Red) and "Cream" (Off-White). This high-contrast pairing provides the "Artisanal Energy" that defines the brand.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts or subtle tonal transitions. A 1px line is a "design crutch" that breaks the organic flow. 

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as physical layers of fine paper.
*   **Base Layer:** `surface` (#FFF9F0) for the main canvas.
*   **Mid-Level:** `surface-container-low` (#F9F3EA) for secondary content areas.
*   **High-Level:** `surface-container-highest` (#E7E2D9) for cards or interactive elements.
*   **The "Glass & Gradient" Rule:** For floating navigation or hero elements, use Glassmorphism. Apply `surface` at 80% opacity with a `backdrop-blur: 20px`. This allows the vibrant `--primary` energy to bleed through the background, softening the layout.

### Signature Textures
Main CTAs and Hero sections should avoid flat colors. Use a subtle linear gradient (135deg) from `primary` (#AB2D24) to `primary_container` (#CD4539). This adds a "glow" that mimics natural light hitting a warm surface.

---

## 3. Typography
Typography is our primary tool for authority. We pair a sophisticated, high-contrast serif with a modern, functional sans-serif.

*   **Display & Headlines (Noto Serif / Playfair):** Used for "Brand Moments." These should be oversized, tight-leaded, and occasionally use negative letter-spacing for a premium editorial feel.
*   **Body & Titles (Inter):** Used for "Utility." Inter provides the functional clarity needed for menus and descriptions.
*   **Hierarchy as Identity:** Use `display-lg` (3.5rem) sparingly to anchor pages. Ensure `headline-md` (1.75rem) has enough whitespace around it to act as a visual "cleanser" between content blocks.

---

## 4. Elevation & Depth
In this design system, depth is a feeling, not a shadow. We achieve it through **Tonal Layering**.

*   **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. The shift in tone creates a natural, soft lift.
*   **Ambient Shadows:** If a shadow is required for a floating state, use an "Ambient Glow." 
    *   *Properties:* Blur: 40px, Spread: -10px, Opacity: 6%. 
    *   *Color:* Use a tinted version of `on_surface` (#1D1B16) to ensure the shadow feels like a natural part of the warm environment, not a grey smudge.
*   **The Ghost Border Fallback:** If accessibility requires a border, use `outline_variant` (#E1BFBA) at **15% opacity**. It should be barely perceptible—a "ghost" of a line.

---

## 5. Components

### Buttons
*   **Primary:** Gradient from `primary` to `primary_container`. Text in `on_primary` (#FFFFFF). Radius: `xl` (1.5rem).
*   **Secondary:** `surface_container_high` background with `primary` text. No border.
*   **Tertiary:** Bold `title-sm` typography in `primary` with a subtle `accent` (#F4A261) underline.

### Input Fields
*   **Style:** Minimalist. No border-box. Use a `surface_container` background with a slightly darker `surface_dim` bottom-weighted shadow. 
*   **State:** When focused, the background shifts to `surface_bright` and a 2px "glow" of `accent` appears at the bottom.

### Cards & Lists
*   **Card Strategy:** Forbid divider lines. Separate items using the `Spacing Scale (8)` (2.75rem). Use `surface_variant` for subtle grouping boxes with a radius of `lg` (1rem).
*   **Menu Items:** Use `headline-sm` for the item name and `label-md` in `text-muted` for the price, right-aligned. Use whitespace to guide the eye.

### Signature Components: "The Brew-Bar"
*   A custom progress indicator for orders using a fluid, organic shape that fills with the `accent` (#F4A261) color, mimicking the pouring of coffee.

---

## 6. Do’s and Don’ts

### Do:
*   **DO** use the `24` (8.5rem) spacing token for hero margins to create an "Editorial" feel.
*   **DO** overlap images with text blocks using absolute positioning to break the "web block" look.
*   **DO** use the `tertiary` (#8B4C11) color for micro-interactions like hover states on small links.

### Don't:
*   **DON'T** use pure white (#FFFFFF) for backgrounds; it is too clinical for the "Artisanal" brand. Always use `surface`.
*   **DON'T** use 100% black text. Always use `on_surface` (#1D1B16) for a softer, premium espresso tone.
*   **DON'T** use tight, 90-degree corners. Everything must feel approachable via the `radius: xl` or `radius: lg` tokens.
*   **DON'T** use standard horizontal dividers. If you must separate, use a `surface-variant` color shift or 4rem of empty space.