import chroma from 'chroma-js';
import { getCategoryAccent } from '@/lib/palette';
import type { BrandPalette } from '@/lib/palette';
import type { Category } from '@/types';

interface Props {
  category: Category;
  palette: BrandPalette;
}

export default function SectionHeading({ category, palette }: Props) {
  const [h] = chroma(palette.primary).hsl();
  const hue = isNaN(h) ? 30 : h;
  const accentColor = getCategoryAccent(hue, category.name);

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 800,
          color: palette.dark,
          lineHeight: 1.2,
        }}
      >
        {category.name}
      </div>
      {category.name_hindi && (
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 400,
            color: palette.midDark,
            marginTop: 4,
          }}
        >
          {category.name_hindi}
        </div>
      )}
      {/* Category accent line */}
      <div
        style={{
          width: 40,
          height: 3,
          borderRadius: 2,
          backgroundColor: accentColor,
          marginTop: 8,
        }}
      />
    </div>
  );
}
