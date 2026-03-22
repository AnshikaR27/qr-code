'use client';

import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  primaryColor: string;
}

export default function SearchBar({ value, onChange, primaryColor }: Props) {
  return (
    <div className="px-4 py-2.5 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors"
          style={{ color: value ? primaryColor : '#9ca3af' }}
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search dishes, ingredients…"
          className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 transition-all outline-none border-2"
          style={{
            backgroundColor: `${primaryColor}08`,
            borderColor: value ? `${primaryColor}60` : 'transparent',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = `${primaryColor}60`; e.currentTarget.style.backgroundColor = `${primaryColor}10`; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = value ? `${primaryColor}60` : 'transparent'; e.currentTarget.style.backgroundColor = `${primaryColor}08`; }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}
          >
            <X className="w-3 h-3" strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}
