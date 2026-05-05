import type { FloorCapacity, FloorDoor, FloorTable, FloorWall, FloorCounter } from '@/types';

// ─── Table sizes (must match both views) ─────────────────────────────────────

export function fpTableSize(capacity: FloorCapacity) {
  if (capacity <= 2) return { w: 70, h: 70 };
  if (capacity <= 4) return { w: 90, h: 90 };
  if (capacity <= 6) return { w: 130, h: 80 };
  return { w: 160, h: 80 };
}

// ─── Architectural walls ─────────────────────────────────────────────────────

export function WallsSvgLayer({
  walls,
  canvasW,
  canvasH,
  selectedWallId,
  strokeScale = 1,
  dark,
}: {
  walls: FloorWall[];
  canvasW: number;
  canvasH: number;
  selectedWallId?: string | null;
  strokeScale?: number;
  dark?: boolean;
}) {
  if (walls.length === 0) return null;
  const thin = strokeScale < 1;
  return (
    <svg
      width={canvasW}
      height={canvasH}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      {!thin && (
        <defs>
          <filter id="wall-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={dark ? '#000' : '#000'} floodOpacity={dark ? 0.4 : 0.12} />
          </filter>
        </defs>
      )}
      {walls.map(wall => {
        const isSel = selectedWallId === wall.id;
        return (
          <g key={wall.id} filter={isSel || thin ? undefined : 'url(#wall-shadow)'}>
            <polygon
              points={wall.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={isSel ? '#2563eb' : dark ? '#9ca3af' : '#374151'}
              strokeWidth={(isSel ? 10 : 9) * strokeScale}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polygon
              points={wall.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={isSel ? '#3b82f6' : dark ? '#d1d5db' : '#1f2937'}
              strokeWidth={(isSel ? 6 : 5) * strokeScale}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Counter with surface treatment ──────────────────────────────────────────

export function CounterElement({
  counter,
  interactive,
  isSelected,
  style,
  ...htmlProps
}: {
  counter: FloorCounter;
  interactive?: boolean;
  isSelected?: boolean;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  return (
    <div
      style={{
        position: 'absolute',
        left: counter.x,
        top: counter.y,
        width: counter.width,
        height: counter.height,
        borderRadius: 6,
        border: isSelected ? '2px solid #2563eb' : '2px solid #4b5563',
        zIndex: 1,
        cursor: interactive ? 'grab' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(37,99,235,0.2)'
          : '0 2px 6px rgba(0,0,0,0.12)',
        ...style,
      }}
      {...htmlProps}
    >
      {/* Main surface */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(45deg, #6b7280, #6b7280 2px, #9ca3af 2px, #9ca3af 6px)',
      }} />
      {/* Top surface highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
        borderRadius: '4px 4px 0 0',
      }} />
      <span style={{
        position: 'relative',
        fontSize: 12,
        fontWeight: 700,
        color: 'white',
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
      }}>
        Counter
      </span>
    </div>
  );
}

// ─── Architectural door arcs ─────────────────────────────────────────────────

export function DoorArcsSvgLayer({
  doors,
  canvasW,
  canvasH,
  dark,
}: {
  doors: FloorDoor[];
  canvasW: number;
  canvasH: number;
  dark?: boolean;
}) {
  if (doors.length === 0) return null;
  const DOOR_LEN = 28;
  return (
    <svg
      width={canvasW}
      height={canvasH}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      {doors.map(door => (
        <g key={door.id} transform={`translate(${door.x}, ${door.y}) rotate(${door.rotation})`}>
          <line
            x1={0} y1={0} x2={DOOR_LEN} y2={0}
            stroke={dark ? '#9ca3af' : '#4b5563'}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d={`M ${DOOR_LEN} 0 A ${DOOR_LEN} ${DOOR_LEN} 0 0 1 0 ${DOOR_LEN}`}
            fill="none"
            stroke={dark ? '#6b7280' : '#9ca3af'}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <circle cx={0} cy={0} r={2.5} fill={dark ? '#9ca3af' : '#4b5563'} />
        </g>
      ))}
    </svg>
  );
}

// ─── Outdoor zone background ─────────────────────────────────────────────────

const OUTDOOR_KEYWORDS = ['outdoor', 'garden', 'patio', 'terrace', 'deck', 'balcony', 'yard', 'open air'];

export function isOutdoorZone(name: string): boolean {
  const lower = name.toLowerCase();
  return OUTDOOR_KEYWORDS.some(kw => lower.includes(kw));
}

export const OUTDOOR_PATTERN_CSS: React.CSSProperties = {
  backgroundImage: [
    'radial-gradient(circle, rgba(34,197,94,0.08) 1px, transparent 1px)',
    'radial-gradient(circle, rgba(34,197,94,0.06) 1.5px, transparent 1.5px)',
  ].join(', '),
  backgroundSize: '16px 16px, 24px 24px',
  backgroundPosition: '0 0, 8px 8px',
};

// ─── Table drop shadow CSS ───────────────────────────────────────────────────

export const TABLE_DROP_SHADOW = 'drop-shadow(0 2px 3px rgba(0,0,0,0.10))';
