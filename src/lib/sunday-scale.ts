/**
 * sunday-scale.ts — Fluid typography + sizing for all customer-facing V2 menu components.
 *
 * Every value is a CSS clamp() string that interpolates linearly between:
 *   320px viewport (iPhone SE / budget Android) → minimum value
 *   480px viewport (large phones / small tablets) → maximum value
 *
 * Usage in components:
 *   import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
 *   <h3 style={{ fontSize: typeScale.md }} />
 *   <div style={{ width: sizeScale.dishImage, height: sizeScale.dishImage }} />
 *   <div style={{ padding: spacingScale.cardPad }} />
 *
 * To fix a size issue on any phone: change the values here — never in individual components.
 * clamp() means it works on every screen width automatically (320px → 480px+).
 */

/** Generates `clamp(MINpx, preferred, MAXpx)` that linearly interpolates
 *  between minPx and maxPx as viewport width goes from minVw to maxVw. */
function fluid(minPx: number, maxPx: number, minVw = 320, maxVw = 480): string {
  const slope     = (maxPx - minPx) / (maxVw - minVw);
  const intercept = +(minPx - slope * minVw).toFixed(4);
  const slopeVw   = +(slope * 100).toFixed(4);

  let preferred: string;
  if (intercept === 0) {
    preferred = `${slopeVw}vw`;
  } else if (intercept > 0) {
    preferred = `calc(${slopeVw}vw + ${intercept}px)`;
  } else {
    preferred = `calc(${slopeVw}vw - ${Math.abs(intercept)}px)`;
  }

  return `clamp(${minPx}px, ${preferred}, ${maxPx}px)`;
}

// ─── Typography ──────────────────────────────────────────────────────────────
// Apply via: style={{ fontSize: typeScale.body }}

export const typeScale = {
  /** 14→16px  inline emoji badges (veg/non-veg, spicy, star) next to dish name */
  emojiBadgeSmall: fluid(14, 16),
  /** 11→13px  badges, secondary meta (Popular, Jain, allergens, sold-out) */
  xs:    fluid(11, 13),
  /** 12→14px  dish descriptions, add-on row text, helper labels */
  sm:    fluid(12, 14),
  /** 13→15px  general body copy, category tab labels, dish card prices */
  body:  fluid(13, 15),
  /** 14→16px  cart item names, cart-bar main text, add-to-order button */
  md:    fluid(14, 16),
  /** 15→17px  basket title, subtotal labels, prominent body text */
  lg:    fluid(15, 17),
  /** 16→18px  restaurant name in navbar (no-logo fallback) */
  base:  fluid(16, 18),
  /** 18→22px  category section headings (h2) in the menu scroll */
  xl:    fluid(18, 22),
  /** 20→24px  dish name heading inside detail sheet (h2) */
  '2xl': fluid(20, 24),
  /** 22→28px  restaurant name on welcome screen (h1) */
  '3xl': fluid(22, 28),
} as const;

// ─── Element sizes ────────────────────────────────────────────────────────────
// Apply via: style={{ width: sizeScale.dishImage, height: sizeScale.dishImage }}

export const sizeScale = {
  /** 36→44px  icon buttons (back arrow, search), generic touch targets */
  touchTarget: fluid(36, 44),
  /** 36→44px  navbar logo image height */
  logoHeight:  fluid(36, 44),
  /** 100→128px  dish card food thumbnail (square) */
  dishImage:   fluid(100, 128),
  /** 36→44px  circular + button on dish card */
  addBtn:      fluid(36, 44),
  /** 40→48px  cart sheet item thumbnail */
  cartThumb:   fluid(40, 48),
  /** 24→28px  cart bar item-count badge circle */
  cartBadge:   fluid(24, 28),
  /** 46→52px  cart bar button height */
  cartBarH:    fluid(46, 52),
  /** 88→110px  welcome screen restaurant logo circle */
  logoCircle:  fluid(88, 110),
  /** 72→90px  image inside welcome screen logo circle */
  logoImg:     fluid(72, 90),
  /** 60→75px  negative overlap of logo circle over hero (use as marginTop negated) */
  logoOverlap: `calc(${fluid(60, 75)} * -1)`,
  /** 36→44px  detail-sheet qty stepper button width */
  stepperW:    fluid(36, 44),
  /** 40→48px  detail-sheet qty stepper button height */
  stepperH:    fluid(40, 48),
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Apply via: style={{ paddingLeft: spacingScale.px, paddingRight: spacingScale.px }}

export const spacingScale = {
  /** 12→16px  standard horizontal panel padding */
  px:      fluid(12, 16),
  /** 12→14px  card inner padding (all four sides) */
  cardPad: fluid(12, 14),
  /** 8→12px   nav bar vertical padding (default / unscrolled) */
  navPy:   fluid(8, 12),
  /** 6→10px   nav bar vertical padding (scrolled / compact) */
  navPyS:  fluid(6, 10),
  /** 10→14px  category tab pill horizontal padding */
  tabPx:   fluid(10, 14),
  /** 6→8px    category tab pill vertical padding */
  tabPy:   fluid(6, 8),
  /** 12→16px  generic flex/grid gap */
  gap:     fluid(12, 16),
  /** 14→20px  vertical gap between dish cards in the menu list */
  dishGap: fluid(14, 20),
} as const;

export type TypeScale    = typeof typeScale;
export type SizeScale    = typeof sizeScale;
export type SpacingScale = typeof spacingScale;
