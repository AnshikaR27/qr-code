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
        className="pointer-events-auto w-full h-[46px] min-[400px]:h-[52px] flex items-center justify-between px-4 min-[400px]:px-5 border-none cursor-pointer transition-all duration-200 active:scale-[0.98]"
        style={{
          borderRadius: 'calc(var(--sunday-radius, 12px) * 1.5)',
          background: 'linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))',
          opacity: hasItems ? 1 : 0.7,
          boxShadow: 'var(--sunday-shadow-lg)',
        }}
      >
        <span className="text-[14px] min-[400px]:text-[16px] font-semibold text-white" style={{ fontFamily: 'var(--sunday-font-body)' }}>
          {hasItems ? `View your order · ${formatPrice(total)}` : 'View your order'}
        </span>
        <div
          className="w-6 h-6 min-[400px]:w-7 min-[400px]:h-7 rounded-full bg-white flex items-center justify-center text-[11px] min-[400px]:text-xs font-black"
          style={{ color: 'var(--sunday-accent, #1A1A1A)', fontFamily: 'var(--sunday-font-body)' }}
        >
          {itemCount}
        </div>
      </button>
    </div>
  );
}
