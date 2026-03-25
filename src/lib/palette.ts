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

// Helper: hex/named color → rgba string
export function alpha(hex: string, a: number): string {
  try {
    return chroma(hex).alpha(a).css();
  } catch {
    return hex;
  }
}
