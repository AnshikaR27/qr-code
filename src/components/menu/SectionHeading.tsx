import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  category: Category;
  tokens: MenuTokens;
}

export default function SectionHeading({ category, tokens }: Props) {
  return (
    <div style={{ padding: '44px 20px 12px' }}>
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

      {/* Accent underline */}
      <div
        style={{
          width: 32,
          height: 3,
          borderRadius: 2,
          backgroundColor: tokens.accent,
          marginTop: 8,
          opacity: 0.6,
        }}
      />

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
