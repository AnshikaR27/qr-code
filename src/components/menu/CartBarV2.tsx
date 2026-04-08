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
      className="fixed w-full max-w-[480px] z-40 pointer-events-none px-4"
      style={{
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <button
        onClick={onOpen}
        className="pointer-events-auto w-full flex items-center justify-between border-none cursor-pointer transition-all duration-200 active:scale-[0.98]"
        style={{
          height: sizeScale.cartBarH,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5)',
          background: 'linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))',
          opacity: hasItems ? 1 : 0.7,
          boxShadow: 'var(--sunday-shadow-lg)',
        }}
      >
        <span
          className="font-semibold text-white"
          style={{ fontSize: typeScale.md, fontFamily: 'var(--sunday-font-body)' }}
        >
          {hasItems ? `View your order · ${formatPrice(total)}` : 'View your order'}
        </span>
        <div
          className="rounded-full bg-white flex items-center justify-center font-black"
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
