export interface MenuTokens {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  cardBg: string;
  text: string;
  textMuted: string;
  fontHeading: string;
  fontBody: string;
  radius: string;
  // Semantic
  navBg: string;
  surfaceLow: string;
  success: string;
  error: string;
  badgeBg: string;
  badgeText: string;
  veg: string;
  nonveg: string;
  // Derived
  headerBg: string;
  headerGradient: string;
  ctaGradient: string;
  border: string;
  // Elevation
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
}

/** Shifts a hex color toward lighter (dark bg) or darker (light bg) by a given amount. */
function shiftColor(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const delta = lum > 0.5 ? -amount : amount;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `#${clamp(r + delta).toString(16).padStart(2, '0')}${clamp(g + delta).toString(16).padStart(2, '0')}${clamp(b + delta).toString(16).padStart(2, '0')}`;
}
function shiftBg(hex: string): string { return shiftColor(hex, 14); }

/** Returns perceived luminance 0–1 for a hex color. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 1;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const DEFAULT_TOKENS: MenuTokens = {
  primary: '#8B6914',
  secondary: '#3E2B1A',
  accent: '#C8991A',
  bg: '#FFF8F0',
  cardBg: '#FFFFFF',
  text: '#1D1208',
  textMuted: '#7A6040',
  // Use Epilogue + Manrope loaded in layout.tsx — fall back to system fonts
  fontHeading: "'Epilogue', Georgia, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
  radius: '12px',
  navBg: shiftBg('#FFF8F0'),
  surfaceLow: shiftColor('#FFF8F0', 7),
  success: '#0F8A00',
  error: '#E23744',
  badgeBg: '#C8991A',
  badgeText: '#ffffff',
  veg: '#0F8A00',
  nonveg: '#E23744',
  headerBg: shiftBg('#FFF8F0'),
  headerGradient: '#FFF8F0',
  ctaGradient: 'linear-gradient(135deg, #8B6914, #C8991A)',
  border: '#E8D5B0',
  shadowSm: `0 1px 3px #8B69140F, 0 1px 2px #8B691408`,
  shadowMd: `0 4px 6px #8B691414, 0 2px 4px #8B69140A`,
  shadowLg: `0 10px 25px #8B69141F, 0 4px 10px #8B691414`,
};

export function buildMenuTokens(raw: Record<string, string> | null | undefined): MenuTokens {
  if (!raw) return DEFAULT_TOKENS;
  const t = (key: string, fallback: string) => (raw[key] ?? fallback).trim();
  const primary = t('--primary', DEFAULT_TOKENS.primary);
  const secondary = t('--secondary', DEFAULT_TOKENS.secondary);
  const accent = t('--accent', DEFAULT_TOKENS.accent);
  const bg = t('--bg', DEFAULT_TOKENS.bg);
  const headerBg = shiftBg(bg);
  const isDark = luminance(bg) < 0.5;

  // Derive smart fallbacks from bg luminance so dark-themed restaurants
  // get readable text even when they don't explicitly provide --text / --card-bg.
  const textDefault    = isDark ? '#F5F5F0' : DEFAULT_TOKENS.text;
  const mutedDefault   = isDark ? '#A09888' : DEFAULT_TOKENS.textMuted;
  const cardBgDefault  = isDark ? shiftColor(bg, 16) : DEFAULT_TOKENS.cardBg;
  const borderDefault  = isDark ? shiftColor(bg, 22) : DEFAULT_TOKENS.border;

  // Build shadow tokens using primary color for tinted shadows
  const shadowSm = `0 1px 3px ${primary}0F, 0 1px 2px ${primary}08`;
  const shadowMd = `0 4px 8px ${primary}14, 0 2px 4px ${primary}0A`;
  const shadowLg = `0 10px 25px ${primary}1F, 0 4px 10px ${primary}14`;

  return {
    primary,
    secondary,
    accent,
    bg,
    cardBg: t('--card-bg', cardBgDefault),
    text: t('--text', textDefault),
    textMuted: t('--text-muted', mutedDefault),
    fontHeading: t('--font-heading', DEFAULT_TOKENS.fontHeading),
    fontBody: t('--font-body', DEFAULT_TOKENS.fontBody),
    radius: t('--radius', DEFAULT_TOKENS.radius),
    navBg: t('--nav-bg', headerBg),
    surfaceLow: shiftColor(bg, 7),
    success: t('--success', DEFAULT_TOKENS.success),
    error: t('--error', DEFAULT_TOKENS.error),
    badgeBg: t('--badge-bg', accent),
    badgeText: t('--badge-text', DEFAULT_TOKENS.badgeText),
    veg: t('--veg', DEFAULT_TOKENS.veg),
    nonveg: t('--nonveg', DEFAULT_TOKENS.nonveg),
    headerBg,
    headerGradient: bg,
    ctaGradient: `linear-gradient(135deg, ${primary}, ${accent})`,
    border: t('--border', borderDefault),
    shadowSm,
    shadowMd,
    shadowLg,
  };
}
