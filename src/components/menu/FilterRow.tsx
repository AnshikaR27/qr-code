'use client';

import { useState, useRef, useEffect } from 'react';
import type { DietFilter } from '@/lib/constants';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
  dietFilter: DietFilter;
  onDietFilterChange: (f: DietFilter) => void;
}

const DIET_OPTIONS: { value: DietFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-Veg' },
  { value: 'jain', label: 'Jain' },
];

export default function FilterRow({
  categories,
  selectedCategoryId,
  onCategoryChange,
  dietFilter,
  onDietFilterChange,
}: Props) {
  const [catOpen, setCatOpen] = useState(false);
  const [dietOpen, setDietOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const dietRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
      if (dietRef.current && !dietRef.current.contains(e.target as Node)) setDietOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedCat = categories.find((c) => c.id === selectedCategoryId);
  const selectedDiet = DIET_OPTIONS.find((d) => d.value === dietFilter);

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    color: '#1D1D1D',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    border: '1px solid #E0E0E0',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden',
  };

  const dropItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    textAlign: 'left',
    border: 'none',
    background: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    color: '#1D1D1D',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #F0F0F0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Category dropdown */}
      <div ref={catRef} style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => { setCatOpen((o) => !o); setDietOpen(false); }}
        >
          <span>☰</span>
          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedCat?.name ?? 'Category'}
          </span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
        </button>
        {catOpen && (
          <div style={dropdownStyle}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                style={{
                  ...dropItemStyle,
                  backgroundColor: cat.id === selectedCategoryId ? '#F5F5F5' : 'transparent',
                  fontWeight: cat.id === selectedCategoryId ? 700 : 600,
                }}
                onClick={() => { onCategoryChange(cat.id); setCatOpen(false); }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Diet filter dropdown */}
      <div ref={dietRef} style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => { setDietOpen((o) => !o); setCatOpen(false); }}
        >
          <span>{selectedDiet?.label ?? 'All'}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
        </button>
        {dietOpen && (
          <div style={dropdownStyle}>
            {DIET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                style={{
                  ...dropItemStyle,
                  backgroundColor: opt.value === dietFilter ? '#F5F5F5' : 'transparent',
                  fontWeight: opt.value === dietFilter ? 700 : 600,
                }}
                onClick={() => { onDietFilterChange(opt.value); setDietOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
