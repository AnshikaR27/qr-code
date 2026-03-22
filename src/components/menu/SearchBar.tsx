'use client';

// SearchBar is now integrated into FilterBar as a single row.
// This component is kept for standalone use if needed.

interface Props {
  value: string;
  onChange: (v: string) => void;
  primaryColor: string;
}

export default function SearchBar({ value, onChange, primaryColor }: Props) {
  const h = primaryColor.startsWith('#') ? primaryColor.slice(1) : primaryColor;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  return (
    <div style={{ padding: '0 14px 10px', backgroundColor: '#000' }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
        {value && (
          <button
            onClick={() => onChange('')}
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
