'use client';

import { cn } from '@/lib/utils';
import type { DietFilter } from '@/lib/constants';

const FILTERS: { value: DietFilter; label: string; icon: string }[] = [
  { value: 'all',     label: 'All',     icon: '🍽️' },
  { value: 'veg',     label: 'Veg',     icon: '🟢' },
  { value: 'non_veg', label: 'Non-Veg', icon: '🔴' },
  { value: 'jain',    label: 'Jain',    icon: '🌿' },
];

interface Props {
  active: DietFilter;
  onChange: (f: DietFilter) => void;
  primaryColor: string;
}

export default function FilterBar({ active, onChange, primaryColor }: Props) {
  return (
    <div
      className="flex gap-2 px-5 py-2.5 overflow-x-auto scrollbar-hide bg-white/90 backdrop-blur-md border-b border-gray-100"
    >
      {FILTERS.map((f) => {
        const isActive = active === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full',
              'text-xs font-bold transition-all duration-200 active:scale-95 select-none',
            )}
            style={
              isActive
                ? {
                    backgroundColor: primaryColor,
                    color: 'white',
                    boxShadow: `0 3px 10px ${primaryColor}50`,
                  }
                : {
                    backgroundColor: `${primaryColor}10`,
                    color: `${primaryColor}cc`,
                  }
            }
          >
            <span className="text-[12px]">{f.icon}</span>
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
