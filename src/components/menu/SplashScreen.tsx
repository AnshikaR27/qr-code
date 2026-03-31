'use client';

import { useState, useMemo } from 'react';
import type { MenuTokens } from '@/lib/tokens';
import type { Restaurant } from '@/types';

// ── Seeded PRNG (LCG) ────────────────────────────────────────────────────────
function makeRng(slug: string) {
  // djb2 hash → seed
  let seed = slug.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 5381);
  seed = seed >>> 0;
  return function next() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// ── Pattern shapes ────────────────────────────────────────────────────────────
interface Shape {
  type: 'circle' | 'dot' | 'cross' | 'triangle';
  x: number; y: number;
  r?: number; s?: number; rot?: number;
  opacity: number;
}

function buildPattern(slug: string): Shape[] {
  const rng = makeRng(slug);
  const shapes: Shape[] = [];
  const W = 390; const H = 844;

  // Large soft circles (ambient blobs)
  for (let i = 0; i < 14; i++) {
    shapes.push({
      type: 'circle',
      x: rng() * W, y: rng() * H,
      r: 24 + rng() * 60,
      opacity: 0.06 + rng() * 0.07,
    });
  }

  // Small dots (grid-ish but jittered)
  const cols = 8; const rows = 14;
  const gx = W / cols; const gy = H / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng() > 0.55) continue; // sparse
      shapes.push({
        type: 'dot',
        x: col * gx + rng() * gx * 0.7 + gx * 0.15,
        y: row * gy + rng() * gy * 0.7 + gy * 0.15,
        r: 2 + rng() * 3,
        opacity: 0.08 + rng() * 0.10,
      });
    }
  }

  // Crosses
  for (let i = 0; i < 18; i++) {
    shapes.push({
      type: 'cross',
      x: rng() * W, y: rng() * H,
      s: 5 + rng() * 10,
      rot: rng() * 45,
      opacity: 0.07 + rng() * 0.09,
    });
  }

  // Triangles
  for (let i = 0; i < 10; i++) {
    shapes.push({
      type: 'triangle',
      x: rng() * W, y: rng() * H,
      s: 8 + rng() * 14,
      rot: rng() * 360,
      opacity: 0.06 + rng() * 0.08,
    });
  }

  return shapes;
}

// Build triangle polygon points centered at 0,0 then translated
function trianglePoints(s: number): string {
  const h = (s * Math.sqrt(3)) / 2;
  return `0,${-h * 0.67} ${s / 2},${h * 0.33} ${-s / 2},${h * 0.33}`;
}

// ── Open/Closed helpers ───────────────────────────────────────────────────────
function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m > 0 ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}
function getHoursStatus(opening: string, closing: string): { isOpen: boolean; label: string } {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const open = parseHHMM(opening);
  const close = parseHHMM(closing);
  const wraps = close < open; // e.g. opens 22:00, closes 02:00
  const isOpen = wraps ? cur >= open || cur < close : cur >= open && cur < close;
  if (isOpen) return { isOpen: true, label: `Closes at ${formatTime12(closing)}` };
  return { isOpen: false, label: `Opens at ${formatTime12(opening)}` };
}

// ── Contrast text color ───────────────────────────────────────────────────────
function contrastColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  restaurant: Restaurant;
  tokens: MenuTokens;
  onEnter: () => void;
}

export default function SplashScreen({ restaurant, tokens, onEnter }: Props) {
  const [phase, setPhase] = useState<'visible' | 'exiting'>('visible');

  const shapes = useMemo(() => buildPattern(restaurant.slug), [restaurant.slug]);
  const hours = useMemo(
    () => getHoursStatus(restaurant.opening_time, restaurant.closing_time),
    [restaurant.opening_time, restaurant.closing_time]
  );

  const btnTextColor = contrastColor(tokens.accent);
  const cardRadius = tokens.radius ?? '16px';

  function handleEnter() {
    if (phase === 'exiting') return;
    setPhase('exiting');
    setTimeout(onEnter, 340);
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
    backgroundColor: tokens.bg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 24px env(safe-area-inset-bottom, 24px)',
    overflow: 'hidden',
    transition: 'opacity 340ms ease, transform 340ms cubic-bezier(0.4,0,1,1)',
    opacity: phase === 'exiting' ? 0 : 1,
    transform: phase === 'exiting' ? 'scale(0.96)' : 'scale(1)',
  };

  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes splashPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${tokens.accent}55; }
          60%       { box-shadow: 0 0 0 14px ${tokens.accent}00; }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashLogoIn {
          from { opacity: 0; transform: scale(0.82); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Decorative background pattern (SVG) ── */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {shapes.map((s, i) => {
          if (s.type === 'circle' || s.type === 'dot') {
            return (
              <circle
                key={i}
                cx={s.x} cy={s.y} r={s.r ?? 4}
                fill={tokens.accent}
                fillOpacity={s.opacity}
              />
            );
          }
          if (s.type === 'cross') {
            const sz = s.s ?? 8;
            return (
              <g key={i} transform={`translate(${s.x},${s.y}) rotate(${s.rot ?? 0})`}>
                <line x1={-sz} y1={0} x2={sz} y2={0} stroke={tokens.accent} strokeWidth={1.5} strokeOpacity={s.opacity} strokeLinecap="round" />
                <line x1={0} y1={-sz} x2={0} y2={sz} stroke={tokens.accent} strokeWidth={1.5} strokeOpacity={s.opacity} strokeLinecap="round" />
              </g>
            );
          }
          if (s.type === 'triangle') {
            return (
              <polygon
                key={i}
                points={trianglePoints(s.s ?? 12)}
                fill={tokens.accent}
                fillOpacity={s.opacity}
                transform={`translate(${s.x},${s.y}) rotate(${s.rot ?? 0})`}
              />
            );
          }
          return null;
        })}
      </svg>

      {/* ── Center card ── */}
      <div
        style={{
          backgroundColor: tokens.cardBg,
          borderRadius: cardRadius,
          boxShadow: `0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)`,
          padding: '32px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          maxWidth: 320,
          position: 'relative',
          animation: 'splashFadeUp 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
          animationDelay: '0.1s',
        }}
      >
        {/* Accent top stripe */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 4,
            borderRadius: `${cardRadius} ${cardRadius} 0 0`,
            background: tokens.ctaGradient,
          }}
        />

        {/* Logo or name */}
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            style={{
              width: 108,
              height: 108,
              objectFit: 'contain',
              borderRadius: 12,
              animation: 'splashLogoIn 0.5s ease both',
              animationDelay: '0.25s',
              marginBottom: 18,
            }}
          />
        ) : (
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 12,
              backgroundColor: `${tokens.accent}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
              animation: 'splashLogoIn 0.5s ease both',
              animationDelay: '0.25s',
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontHeading,
                fontSize: 38,
                fontWeight: 800,
                color: tokens.accent,
                lineHeight: 1,
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {restaurant.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Restaurant name */}
        <h1
          style={{
            fontFamily: tokens.fontHeading,
            fontSize: 26,
            fontWeight: 800,
            color: tokens.text,
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.2,
            letterSpacing: '-0.3px',
          }}
        >
          {restaurant.name}
        </h1>

        {/* City */}
        {restaurant.city && (
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: 13,
              color: tokens.textMuted,
              margin: '6px 0 0',
              textAlign: 'center',
            }}
          >
            {restaurant.city}
          </p>
        )}

        {/* Thin divider */}
        <div
          style={{
            width: 40, height: 1,
            backgroundColor: tokens.border,
            margin: '18px 0 20px',
            borderRadius: 1,
          }}
        />

        {/* CTA Button */}
        <button
          onClick={handleEnter}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 9999,
            border: 'none',
            background: tokens.ctaGradient,
            color: btnTextColor,
            fontFamily: tokens.fontBody,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            animation: 'splashPulse 2.2s ease-in-out infinite',
            transition: 'transform 0.12s ease, opacity 0.12s ease',
          }}
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
          onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        >
          Order Now →
        </button>

        {/* Hours status */}
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: 12,
            color: hours.isOpen ? tokens.success : tokens.error,
            margin: '10px 0 0',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {hours.isOpen ? `● Open · ${hours.label}` : `● Closed · ${hours.label}`}
        </p>
      </div>

      {/* Powered by */}
      <p
        style={{
          position: 'absolute',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          fontFamily: tokens.fontBody,
          fontSize: 11,
          color: tokens.textMuted,
          opacity: 0.6,
          margin: 0,
          animation: 'splashFadeUp 0.5s ease both',
          animationDelay: '0.6s',
        }}
      >
        Powered by MenuQR
      </p>
    </div>
  );
}
