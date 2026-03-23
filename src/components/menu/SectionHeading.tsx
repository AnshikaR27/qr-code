'use client';

interface Props {
  title: string;
  primaryColor: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function SectionHeading({ title, primaryColor, isOpen, onToggle }: Props) {
  return (
    <div
      style={{
        padding: '16px 16px 8px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onToggle}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 16,
          fontWeight: 700,
          color: '#1D1D1D',
          flexShrink: 0,
        }}
      >
        {title}
      </span>
      <div
        style={{
          flex: 1,
          height: 1.5,
          backgroundColor: primaryColor,
          marginLeft: 10,
          marginRight: 10,
        }}
      />
      <span
        style={{
          fontSize: 14,
          color: '#999',
          flexShrink: 0,
          lineHeight: 1,
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
        }}
      >
        ∧
      </span>
    </div>
  );
}
