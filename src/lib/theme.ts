// ─── Theme engine ────────────────────────────────────────────────────────────
// Analyses a restaurant's brand colors and returns a complete ThemeConfig that
// drives every visual decision in the customer-facing menu.

export type ThemeVariant = 'classic' | 'dark' | 'bold' | 'minimal';

export interface ThemeConfig {
  variant: ThemeVariant;
  // Page
  pageBg: string;
  // Cards
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Brand accent
  accent: string;
  accentFg: string; // text colour on accent background
  // Header
  headerBg: string;
  headerText: string;
  headerSubtext: string;
  headerBorder: string;
  // Category tabs + filter bar
  tabsBg: string;
  tabsText: string;
  tabsActiveText: string;
  tabsBorder: string;
  // Section header (category group title)
  sectionBg: string;
  sectionTitleColor: string;
  sectionCountColor: string;
  // ADD button
  addButtonOutline: boolean; // true → outlined, false → solid fill
  // Cart bar
  cartBg: string;
  cartText: string;
}

// ─── Colour math helpers ─────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return '#' + [r, g, b]
    .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('');
}

/** Shift the lightness of a hex colour by `delta` (positive = lighter, negative = darker). */
function shiftL(hex: string, delta: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, Math.min(100, l + delta)));
}

/** rgba string from hex + opacity (0–1). */
function alpha(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** True if the colour is perceptually light (foreground should be dark). */
function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // WCAG relative luminance approximation
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// ─── Variant detection ───────────────────────────────────────────────────────

function detectVariant(hex: string): ThemeVariant {
  const [, s, l] = hexToHsl(hex);
  if (l < 36) return 'dark';               // deep / dark colours
  if (s < 28 && l > 52) return 'minimal';  // muted / pastel / near-white
  if (s > 58 && l >= 36 && l <= 66) return 'bold'; // vivid / saturated
  return 'classic';                         // everything else
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getTheme(primaryColor: string): ThemeConfig {
  // Normalise — accept colours with or without leading #
  const p = primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`;
  const variant = detectVariant(p);
  const fg = isLight(p) ? '#111111' : '#ffffff';

  // ── DARK ──────────────────────────────────────────────────────────────────
  if (variant === 'dark') {
    const [h, s] = hexToHsl(p);
    const pageBg  = hslToHex(h, Math.min(s, 28), 8);
    const cardBg  = hslToHex(h, Math.min(s, 22), 14);
    // If the primary itself is very dark, lighten it for visible accents
    const accent  = hexToHsl(p)[2] < 20 ? shiftL(p, 28) : p;

    return {
      variant,
      pageBg,
      cardBg,
      cardBorder: 'rgba(255,255,255,0.07)',
      cardShadow: 'none',
      textPrimary:   '#f1f5f9',
      textSecondary: '#cbd5e1',
      textMuted:     '#64748b',
      accent,
      accentFg: '#ffffff',
      headerBg:      pageBg,
      headerText:    '#f1f5f9',
      headerSubtext: '#64748b',
      headerBorder:  'rgba(255,255,255,0.07)',
      tabsBg:        cardBg,
      tabsText:      '#64748b',
      tabsActiveText:'#f1f5f9',
      tabsBorder:    'rgba(255,255,255,0.07)',
      sectionBg:     cardBg,
      sectionTitleColor: '#f1f5f9',
      sectionCountColor: '#64748b',
      addButtonOutline: false,
      cartBg:   accent,
      cartText: '#ffffff',
    };
  }

  // ── BOLD ──────────────────────────────────────────────────────────────────
  if (variant === 'bold') {
    return {
      variant,
      pageBg:    '#f2f2f2',
      cardBg:    '#ffffff',
      cardBorder:'#e8e8e8',
      cardShadow:'0 1px 4px rgba(0,0,0,0.07)',
      textPrimary:   '#111111',
      textSecondary: '#444444',
      textMuted:     '#888888',
      accent: p,
      accentFg: fg,
      headerBg:      p,
      headerText:    fg,
      headerSubtext: alpha(fg, 0.65),
      headerBorder:  'transparent',
      tabsBg:        '#ffffff',
      tabsText:      '#999999',
      tabsActiveText: p,
      tabsBorder:    '#e8e8e8',
      sectionBg:     '#ffffff',
      sectionTitleColor: '#111111',
      sectionCountColor: '#aaaaaa',
      addButtonOutline: false,
      cartBg:   p,
      cartText: fg,
    };
  }

  // ── MINIMAL ───────────────────────────────────────────────────────────────
  if (variant === 'minimal') {
    // Very light colours become invisible — darken for usability
    const accent = hexToHsl(p)[2] > 78 ? shiftL(p, -30) : p;
    const accentFg = isLight(accent) ? '#111111' : '#ffffff';

    return {
      variant,
      pageBg:    alpha(accent, 0.04),
      cardBg:    '#ffffff',
      cardBorder:'#e5e7eb',
      cardShadow:'none',
      textPrimary:   '#1f2937',
      textSecondary: '#6b7280',
      textMuted:     '#9ca3af',
      accent,
      accentFg,
      headerBg:      '#ffffff',
      headerText:    '#1f2937',
      headerSubtext: '#9ca3af',
      headerBorder:  '#e5e7eb',
      tabsBg:        '#ffffff',
      tabsText:      '#9ca3af',
      tabsActiveText:'#1f2937',
      tabsBorder:    '#e5e7eb',
      sectionBg:     '#ffffff',
      sectionTitleColor: '#1f2937',
      sectionCountColor: '#9ca3af',
      addButtonOutline: true,
      cartBg:   accent,
      cartText: accentFg,
    };
  }

  // ── CLASSIC (default) ─────────────────────────────────────────────────────
  return {
    variant: 'classic',
    pageBg:    '#f3f4f6',
    cardBg:    '#ffffff',
    cardBorder:'#f0f0f0',
    cardShadow:'0 1px 3px rgba(0,0,0,0.05)',
    textPrimary:   '#111827',
    textSecondary: '#6b7280',
    textMuted:     '#9ca3af',
    accent: p,
    accentFg: fg,
    headerBg:      '#ffffff',
    headerText:    '#111827',
    headerSubtext: '#6b7280',
    headerBorder:  '#e5e7eb',
    tabsBg:        '#ffffff',
    tabsText:      '#9ca3af',
    tabsActiveText:'#111827',
    tabsBorder:    '#e5e7eb',
    sectionBg:     '#ffffff',
    sectionTitleColor: '#111827',
    sectionCountColor: '#9ca3af',
    addButtonOutline: true,
    cartBg:   p,
    cartText: fg,
  };
}
