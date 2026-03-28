import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  category: Category;
  tokens: MenuTokens;
}

export default function SectionHeading({ category, tokens }: Props) {
  return (
    <div style={{ padding: '44px 20px 12px' }}>
      {/* Editorial label above — small spaced-out sans-serif per DESIGN.md */}
      <div
        style={{
          fontFamily: tokens.fontBody,
          fontSize: 10,
          fontWeight: 700,
          color: tokens.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          marginBottom: 8,
        }}
      >
        — Menu
      </div>

      {/* Large serif headline — the "Brand Moment" */}
      <div
        style={{
          fontFamily: tokens.fontHeading,
          fontSize: 28,
          fontWeight: 800,
          color: tokens.text,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {category.name}
      </div>

      {/* Hindi name */}
      {category.name_hindi && (
        <div
          style={{
            fontFamily: tokens.fontBody,
            fontSize: 13,
            fontWeight: 400,
            color: tokens.textMuted,
            marginTop: 6,
          }}
        >
          {category.name_hindi}
        </div>
      )}
    </div>
  );
}
