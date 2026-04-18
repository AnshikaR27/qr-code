'use client';

import { formatPrice } from '@/lib/utils';

interface Props {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export default function CartBarV2({ itemCount, total, onOpen }: Props) {
  if (itemCount === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        onClick={onOpen}
        aria-label={`View cart, ${itemCount} items, ${formatPrice(total)}`}
        className="w-full border-none cursor-pointer flex items-center justify-between"
        style={{
          backgroundColor: 'var(--sunday-primary, #361f1a)',
          color: '#fff',
          padding: '14px 20px',
          transition: 'transform 120ms ease-out',
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.995)'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.995)'; }}
        onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        {/* Left: item count badge */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center font-bold"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: 'var(--sunday-accent, #b12d00)',
              fontSize: '12px',
              color: '#fff',
              fontFamily: 'var(--sunday-font-body)',
              flexShrink: 0,
            }}
          >
            {itemCount}
          </div>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--sunday-font-body)',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.01em',
            }}
          >
            {itemCount === 1 ? '1 item' : `${itemCount} items`}
          </span>
        </div>

        {/* Right: total + CTA label */}
        <div className="flex items-center gap-3">
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: 'var(--sunday-font-body)',
              color: '#fff',
              letterSpacing: '-0.01em',
            }}
          >
            {formatPrice(total)}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--sunday-font-body)',
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            View order
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>
    </div>
  );
}
