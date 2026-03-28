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
  // Derived
  headerGradient: string;
  ctaGradient: string;
  border: string;
}

export const DEFAULT_TOKENS: MenuTokens = {
  primary: '#8B6914',
  secondary: '#3E2B1A',
  accent: '#C8991A',
  bg: '#FFF8F0',
  cardBg: '#FFFFFF',
  text: '#1D1208',
  textMuted: '#7A6040',
  fontHeading: 'Georgia, serif',
  fontBody: 'system-ui, sans-serif',
  radius: '12px',
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
    headerGradient: bg,
    ctaGradient: `linear-gradient(135deg, ${primary}, ${accent})`,
    border: t('--border', DEFAULT_TOKENS.border),
  };
}
