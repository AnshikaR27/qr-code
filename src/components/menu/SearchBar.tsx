'use client';

import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  primaryColor: string;
}

export default function SearchBar({ value, onChange, primaryColor }: Props) {
  return (
    <div className="px-4 py-2.5 bg-white border-b border-gray-200">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for dishes…"
          className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 bg-gray-100 outline-none transition-all border-2 border-transparent"
          onFocus={(e) => { e.currentTarget.style.borderColor = `${primaryColor}50`; e.currentTarget.style.backgroundColor = 'white'; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = ''; }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center"
          >
            <X className="w-3 h-3 text-gray-600" strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}
