'use client';

import Image from 'next/image';
import { getContrastText } from '@/lib/utils';
import type { Category } from '@/types';

function getCategoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('starter') || lower.includes('appetizer')) return '🍳';
  if (lower.includes('main') || lower.includes('mains')) return '🍛';
  if (lower.includes('bread') || lower.includes('roti')) return '🫓';
  if (lower.includes('rice') || lower.includes('biryani')) return '🍚';
  if (lower.includes('beverage') || lower.includes('drink')) return '🥤';
  if (lower.includes('dessert') || lower.includes('sweet')) return '🍰';
  if (lower.includes('shake')) return '🥤';
  if (lower.includes('snack')) return '🍿';
  return '🍽️';
}

interface Props {
  category: Category;
  coverImageUrl: string | null;
  primaryColor: string;
  cartItemCount: number;
  onClick: () => void;
  animationDelay: number;
}

export default function CategoryCard({
  category,
  coverImageUrl,
  primaryColor,
  cartItemCount,
  onClick,
  animationDelay,
}: Props) {
  const badgeText = getContrastText(primaryColor);

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'transform 0.15s ease',
        animation: 'fadeIn 0.4s ease both',
        animationDelay: `${animationDelay}ms`,
        position: 'relative',
      }}
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
      onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.97)'; }}
      onTouchEnd={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
    >
      {/* Photo area */}
      <div
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          aspectRatio: '1',
          backgroundColor: '#F5F5F5',
          position: 'relative',
        }}
      >
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={category.name}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 420px) 45vw, 180px"
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 36, opacity: 0.25 }}>
              {getCategoryEmoji(category.name)}
            </span>
          </div>
        )}
      </div>

      {/* Category name */}
      <p
        style={{
          margin: 0,
          marginTop: 12,
          paddingBottom: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 600,
          color: '#1D1D1D',
          textAlign: 'center',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {category.name}
      </p>

      {/* Cart item count badge */}
      {cartItemCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: badgeText,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {cartItemCount}
        </div>
      )}
    </div>
  );
}
