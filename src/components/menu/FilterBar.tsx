'use client';

import type { DietFilter } from '@/lib/constants';

function hexToRgb(hex: string) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const FILTERS: { value: DietFilter; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'veg', label: 'Veg', dot: '#16a34a' },
  { value: 'non_veg', label: 'Non-Veg', dot: '#dc2626' },
  { value: 'jain', label: 'Jain', dot: '#d97706' },
];

interface Props {
  active: DietFilter;
  onChange: (f: DietFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  primaryColor: string;
}

export default function FilterBar({ active, onChange, search, onSearch, primaryColor }: Props) {
  const { r, g, b } = hexToRgb(primaryColor);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px 10px',
        gap: 8,
        backgroundColor: '#000',
      }}
    >
      {/* Diet filter pills */}
      {FILTERS.map((f) => {
        const isActive = active === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s',
              backgroundColor: isActive ? (f.value === 'all' ? '#333' : primaryColor) : 'transparent',
              color: isActive ? '#fff' : '#666',
              border: isActive ? 'none' : `1px solid rgba(${r},${g},${b},0.15)`,
            }}
          >
            {f.dot && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: f.dot,
                  flexShrink: 0,
                }}
              />
            )}
            {f.label}
          </button>
        );
      })}

      {/* Search input */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            opacity: 0.35,
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          🔍
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search dishes…"
          style={{
            width: '100%',
            padding: '7px 28px 7px 28px',
            borderRadius: 8,
            border: `1px solid rgba(${r},${g},${b},0.08)`,
            backgroundColor: `rgba(${r},${g},${b},0.04)`,
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.3)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `rgba(${r},${g},${b},0.08)`;
          }}
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: `rgba(${r},${g},${b},0.12)`,
              color: primaryColor,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
