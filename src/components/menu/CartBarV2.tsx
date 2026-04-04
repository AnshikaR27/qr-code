'use client';

import { formatPrice } from '@/lib/utils';

interface Props {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export default function CartBarV2({ itemCount, total, onOpen }: Props) {
  return (
    <div
      className="fixed w-full max-w-[480px] z-40 pointer-events-none px-4"
      style={{
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: `translateX(-50%) translateY(${itemCount === 0 ? '110%' : '0'})`,
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <button
        onClick={onOpen}
        className="pointer-events-auto w-full h-[52px] rounded-2xl flex items-center justify-between px-5 border-none cursor-pointer shadow-lg"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        <span className="font-body text-[16px] font-semibold text-white">
          View your order · {formatPrice(total)}
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
