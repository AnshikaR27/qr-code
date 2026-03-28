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

export const DEFAULT_TOKENS: MenuTokens = {
  primary: '#8B6914',
  secondary: '#3E2B1A',
  accent: '#C8991A',
  bg: '#FFF8F0',
  cardBg: '#FFFFFF',
  text: '#1D1208',
  textMuted: '#7A6040',
  // Use Playfair Display + Inter loaded in layout.tsx — fall back to system fonts
  fontHeading: 'var(--font-display), Georgia, serif',
  fontBody: 'var(--font-sans), system-ui, sans-serif',
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
};

export function buildMenuTokens(raw: Record<string, string> | null | undefined): MenuTokens {
  if (!raw) return DEFAULT_TOKENS;
  const t = (key: string, fallback: string) => (raw[key] ?? fallback).trim();
  const primary = t('--primary', DEFAULT_TOKENS.primary);
  const secondary = t('--secondary', DEFAULT_TOKENS.secondary);
  const accent = t('--accent', DEFAULT_TOKENS.accent);
  const bg = t('--bg', DEFAULT_TOKENS.bg);
  const headerBg = shiftBg(bg);
  return {
    primary,
    secondary,
    accent,
    bg,
    cardBg: t('--card-bg', DEFAULT_TOKENS.cardBg),
    text: t('--text', DEFAULT_TOKENS.text),
    textMuted: t('--text-muted', DEFAULT_TOKENS.textMuted),
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
    border: t('--border', DEFAULT_TOKENS.border),
  };
}
