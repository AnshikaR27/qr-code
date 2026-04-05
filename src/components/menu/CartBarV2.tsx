'use client';

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
        className="pointer-events-auto w-full h-[52px] rounded-2xl flex items-center justify-between px-5 border-none cursor-pointer shadow-lg transition-opacity duration-200"
        style={{
          background: 'linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))',
          opacity: hasItems ? 1 : 0.7,
        }}
      >
        <span className="font-body text-[16px] font-semibold text-white">
          {hasItems ? `View your order · ${formatPrice(total)}` : 'View your order'}
        </span>
        <div
          className="w-7 h-7 rounded-full bg-white flex items-center justify-center font-body text-xs font-black"
          style={{ color: 'var(--sunday-accent, #1A1A1A)' }}
        >
          {itemCount}
        </div>
      </button>
    </div>
  );
}
