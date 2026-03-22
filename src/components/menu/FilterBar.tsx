'use client';

import { cn } from '@/lib/utils';
import type { DietFilter } from '@/lib/constants';

const FILTERS: { value: DietFilter; label: string; dot: string }[] = [
  { value: 'all',     label: 'All',     dot: '' },
  { value: 'veg',     label: 'Veg',     dot: '#16a34a' },
  { value: 'non_veg', label: 'Non-Veg', dot: '#dc2626' },
  { value: 'jain',    label: 'Jain',    dot: '#d97706' },
];

interface Props {
  active: DietFilter;
  onChange: (f: DietFilter) => void;
  primaryColor: string;
}

export default function FilterBar({ active, onChange, primaryColor }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 overflow-x-auto scrollbar-hide">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 mr-1">
        Filter
      </span>
      {FILTERS.map((f) => {
        const isActive = active === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
              'text-xs font-semibold transition-all duration-150 active:scale-95 select-none',
              isActive
                ? 'border-transparent text-white'
                : 'border-gray-200 text-gray-600 bg-white',
            )}
            style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          >
            {f.dot && (
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: f.dot }}
              />
            )}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
