import Image from 'next/image';
import type { Restaurant } from '@/types';

interface Props {
  restaurant: Restaurant;
}

function hexToRgb(hex: string) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export default function MenuHeader({ restaurant }: Props) {
  const { name, city, logo_url, primary_color, secondary_color } = restaurant;
  const p = primary_color.startsWith('#') ? primary_color : `#${primary_color}`;
  const s = secondary_color.startsWith('#') ? secondary_color : `#${secondary_color}`;
  const { r, g, b } = hexToRgb(p);

  return (
    <header style={{ backgroundColor: s }}>
      {/* 3px accent stripe */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${p}, transparent)` }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 18px 16px' }}>
        {/* Logo circle */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${p}, rgba(${r},${g},${b},0.6))`,
            border: `1.5px solid rgba(${r},${g},${b},0.4)`,
            boxShadow: `0 0 20px rgba(${r},${g},${b},0.3)`,
          }}
        >
          {logo_url ? (
            <Image
              src={logo_url}
              alt={name}
              width={44}
              height={44}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          ) : (
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + city */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              color: '#fff',
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </h1>
          {city && (
            <p
              style={{
                margin: '3px 0 0',
                color: '#666',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              {city.toUpperCase()} · OPEN NOW
            </p>
          )}
          {/* Brand underline */}
          <div
            style={{
              marginTop: 6,
              height: 2,
              width: '60%',
              background: `linear-gradient(90deg, ${p}, transparent)`,
            }}
          />
        </div>
      </div>
    </header>
  );
}
