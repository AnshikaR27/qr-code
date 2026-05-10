'use client';

import { cn } from '@/lib/utils';

export type Period = '7d' | '30d';

interface Props {
  value: Period;
  onChange: (p: Period) => void;
}

export default function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 bg-gray-50">
      {([['7d', 'Last 7 days'], ['30d', 'Last 30 days']] as const).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
            value === key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
