'use client';

import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
import { formatPrice } from '@/lib/utils';

interface Props {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export default function CartBarV2({ itemCount, total, onOpen }: Props) {
  const hasItems = itemCount > 0;

  return (
    <div
      className="fixed w-full max-w-[480px] z-40 px-4"
      style={{
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: hasItems
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(calc(100% + 32px))',
        transition: 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: hasItems ? 'auto' : 'none',
      }}
    >
      <button
        onClick={onOpen}
        aria-label={`View cart, ${itemCount} items`}
        className="w-full flex items-center justify-between border-none cursor-pointer active:scale-[0.98]"
        style={{
          height: sizeScale.cartBarH,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--sunday-primary, #361f1a) 95%, transparent), color-mix(in srgb, var(--sunday-accent, #b12d00) 95%, transparent))',
          boxShadow: '0 -4px 20px rgba(54, 31, 26, 0.15), var(--sunday-shadow-lg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="font-semibold text-white"
            style={{ fontSize: typeScale.md, fontFamily: 'var(--sunday-font-body)' }}
          >
            View your order
          </span>
          {hasItems && (
            <span
              className="font-bold text-white"
              style={{ fontSize: typeScale.md, fontFamily: 'var(--sunday-font-body)', opacity: 0.75 }}
            >
              {formatPrice(total)}
            </span>
          )}
        </span>
        <div
          key={itemCount}
          className="rounded-full bg-white flex items-center justify-center font-black animate-pop-scale"
          style={{
            width: sizeScale.cartBadge,
            height: sizeScale.cartBadge,
            fontSize: typeScale.xs,
            color: 'var(--sunday-accent, #1A1A1A)',
            fontFamily: 'var(--sunday-font-body)',
          }}
        >
          {itemCount}
        </div>
      </button>
    </div>
  );
}
