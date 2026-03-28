import type { MenuTokens } from '@/lib/tokens';
import type { Category } from '@/types';

interface Props {
  category: Category;
  tokens: MenuTokens;
}

export default function SectionHeading({ category, tokens }: Props) {
  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div
        style={{
          fontFamily: tokens.fontHeading,
          fontSize: 18,
          fontWeight: 800,
          color: tokens.text,
          lineHeight: 1.2,
        }}
      >
        {category.name}
      </div>
      {category.name_hindi && (
        <div
          style={{
            fontFamily: tokens.fontBody,
            fontSize: 13,
            fontWeight: 400,
            color: tokens.textMuted,
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
          backgroundColor: tokens.primary,
          marginTop: 8,
        }}
      />
    </div>
  );
}
