'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { MenuTokens } from '@/lib/tokens';

interface Props {
  tokens: MenuTokens;
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export default function CartBarV2({ itemCount, total, onOpen }: Props) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (itemCount === 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 ${
        !reduced && !entered ? 'sunday-cart-slide' : ''
      }`}
    >
      {/* Fade gradient behind */}
      <div className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />

      <button
        onClick={onOpen}
        className="relative w-full flex justify-between items-center px-6 py-4 rounded-2xl text-white border-none cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
        style={{ backgroundColor: 'var(--sunday-accent)' }}
      >
        <span className="font-body text-[15px] font-semibold">
          View your order
        </span>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center font-body text-xs font-black text-white">
            {itemCount}
          </div>
        </div>
      </button>
    </div>
  );
}
