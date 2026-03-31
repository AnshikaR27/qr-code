import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildMenuTokens } from '@/lib/tokens';

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function makeRng(slug: string) {
  let seed = slug.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 5381);
  seed = seed >>> 0;
  return function next() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

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

  for (let i = 0; i < 14; i++) {
    shapes.push({ type: 'circle', x: rng() * W, y: rng() * H, r: 24 + rng() * 60, opacity: 0.06 + rng() * 0.07 });
  }

  const cols = 8; const rows = 14;
  const gx = W / cols; const gy = H / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng() > 0.55) continue;
      shapes.push({ type: 'dot', x: col * gx + rng() * gx * 0.7 + gx * 0.15, y: row * gy + rng() * gy * 0.7 + gy * 0.15, r: 2 + rng() * 3, opacity: 0.08 + rng() * 0.10 });
    }
  }

  for (let i = 0; i < 18; i++) {
    shapes.push({ type: 'cross', x: rng() * W, y: rng() * H, s: 5 + rng() * 10, rot: rng() * 45, opacity: 0.07 + rng() * 0.09 });
  }

  for (let i = 0; i < 10; i++) {
    shapes.push({ type: 'triangle', x: rng() * W, y: rng() * H, s: 8 + rng() * 14, rot: rng() * 360, opacity: 0.06 + rng() * 0.08 });
  }

  return shapes;
}

function trianglePoints(s: number): string {
  const h = (s * Math.sqrt(3)) / 2;
  return `0,${-h * 0.67} ${s / 2},${h * 0.33} ${-s / 2},${h * 0.33}`;
}

// ── Hours helpers ─────────────────────────────────────────────────────────────
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
  const wraps = close < open;
  const isOpen = wraps ? cur >= open || cur < close : cur >= open && cur < close;
  if (isOpen) return { isOpen: true, label: `Closes at ${formatTime12(closing)}` };
  return { isOpen: false, label: `Opens at ${formatTime12(opening)}` };
}

function contrastColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
}

// ── Page ──────────────────────────────────────────────────────────────────────
interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function SplashPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId } = await searchParams;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, slug, logo_url, city, opening_time, closing_time, design_tokens')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!restaurant) notFound();

  const tokens = buildMenuTokens(restaurant.design_tokens as Record<string, string> | null);
  const shapes = buildPattern(slug);
  const hours = getHoursStatus(restaurant.opening_time, restaurant.closing_time);
  const btnTextColor = contrastColor(tokens.accent);
  const menuHref = `/${slug}/menu${tableId ? `?table=${tableId}` : ''}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: tokens.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes splashPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${tokens.accent}55; }
          60%       { box-shadow: 0 0 0 14px ${tokens.accent}00; }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .splash-btn:active { transform: scale(0.97); }
      `}</style>

      {/* ── Decorative SVG pattern ── */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {shapes.map((s, i) => {
          if (s.type === 'circle' || s.type === 'dot') {
            return <circle key={i} cx={s.x} cy={s.y} r={s.r ?? 4} fill={tokens.accent} fillOpacity={s.opacity} />;
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

      {/* ── Card ── */}
      <div
        style={{
          backgroundColor: tokens.cardBg,
          borderRadius: tokens.radius,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '32px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 320,
          position: 'relative',
          animation: 'splashFadeUp 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Accent top stripe */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 4,
            borderRadius: `${tokens.radius} ${tokens.radius} 0 0`,
            background: tokens.ctaGradient,
          }}
        />

        {/* Logo or monogram */}
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            width={108}
            height={108}
            style={{ objectFit: 'contain', borderRadius: 12, marginBottom: 18 }}
          />
        ) : (
          <div
            style={{
              width: 108, height: 108, borderRadius: 12,
              backgroundColor: `${tokens.accent}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <span style={{ fontFamily: tokens.fontHeading, fontSize: 38, fontWeight: 800, color: tokens.accent, lineHeight: 1 }}>
              {restaurant.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Name */}
        <h1
          style={{
            fontFamily: tokens.fontHeading,
            fontSize: 26, fontWeight: 800,
            color: tokens.text,
            margin: 0, textAlign: 'center',
            lineHeight: 1.2, letterSpacing: '-0.3px',
          }}
        >
          {restaurant.name}
        </h1>

        {/* City */}
        {restaurant.city && (
          <p style={{ fontFamily: tokens.fontBody, fontSize: 13, color: tokens.textMuted, margin: '6px 0 0', textAlign: 'center' }}>
            {restaurant.city}
          </p>
        )}

        {/* Divider */}
        <div style={{ width: 40, height: 1, backgroundColor: tokens.border, margin: '18px 0 20px', borderRadius: 1 }} />

        {/* CTA — plain <a>, zero JS required */}
        <a
          href={menuHref}
          className="splash-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 52,
            borderRadius: 9999,
            background: tokens.ctaGradient,
            color: btnTextColor,
            fontFamily: tokens.fontBody,
            fontSize: 16, fontWeight: 800,
            textDecoration: 'none',
            letterSpacing: '0.02em',
            animation: 'splashPulse 2.2s ease-in-out infinite',
            transition: 'transform 0.12s ease',
          }}
        >
          Order Now →
        </a>

        {/* Hours */}
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: 12, fontWeight: 600,
            color: hours.isOpen ? tokens.success : tokens.error,
            margin: '10px 0 0', textAlign: 'center',
          }}
        >
          {hours.isOpen ? `● Open · ${hours.label}` : `● Closed · ${hours.label}`}
        </p>
      </div>

      {/* Powered by */}
      <p
        style={{
          position: 'absolute',
          bottom: 16,
          fontFamily: tokens.fontBody,
          fontSize: 11,
          color: tokens.textMuted,
          opacity: 0.6,
          margin: 0,
        }}
      >
        Powered by MenuQR
      </p>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, city')
    .eq('slug', slug)
    .single();

  if (!restaurant) return { title: 'Menu' };

  return {
    title: restaurant.city ? `${restaurant.name} · ${restaurant.city}` : restaurant.name,
    description: `Scan to view the menu and order from ${restaurant.name}`,
  };
}
