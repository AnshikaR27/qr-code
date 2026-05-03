import type { FloorCapacity, FloorDoor, FloorTable, FloorWall, FloorCounter } from '@/types';

// ─── Table sizes (must match both views) ─────────────────────────────────────

export function fpTableSize(capacity: FloorCapacity) {
  if (capacity <= 2) return { w: 70, h: 70 };
  if (capacity <= 4) return { w: 90, h: 90 };
  if (capacity <= 6) return { w: 130, h: 80 };
  return { w: 160, h: 80 };
}

// ─── Chair positions ─────────────────────────────────────────────────────────

const CHAIR_W = 14;
const CHAIR_H = 8;
const CHAIR_GAP = 5;
const CHAIR_RX = 3;
const CHAIR_FILL = '#c4b998';
const CHAIR_FILL_OCCUPIED = '#9a8b6e';

interface ChairPos {
  x: number;
  y: number;
  rotation: number;
}

function getChairPositions(shape: 'round' | 'square', capacity: FloorCapacity): ChairPos[] {
  const { w, h } = fpTableSize(capacity);
  const chairs: ChairPos[] = [];

  if (shape === 'round') {
    const cx = w / 2;
    const cy = h / 2;
    const dist = w / 2 + CHAIR_GAP + CHAIR_H / 2;
    for (let i = 0; i < capacity; i++) {
      const angle = (i * 2 * Math.PI) / capacity - Math.PI / 2;
      chairs.push({
        x: cx + dist * Math.cos(angle),
        y: cy + dist * Math.sin(angle),
        rotation: (angle * 180) / Math.PI + 90,
      });
    }
  } else {
    let top: number, right: number, bottom: number, left: number;
    if (capacity <= 2) {
      top = 1; bottom = 1; left = 0; right = 0;
    } else if (capacity <= 4) {
      top = 1; right = 1; bottom = 1; left = 1;
    } else if (capacity <= 6) {
      top = 2; bottom = 2; left = 1; right = 1;
    } else {
      top = 3; bottom = 3; left = 1; right = 1;
    }

    for (let i = 0; i < top; i++) {
      chairs.push({
        x: (w / (top + 1)) * (i + 1),
        y: -(CHAIR_GAP + CHAIR_H / 2),
        rotation: 0,
      });
    }
    for (let i = 0; i < bottom; i++) {
      chairs.push({
        x: (w / (bottom + 1)) * (i + 1),
        y: h + CHAIR_GAP + CHAIR_H / 2,
        rotation: 0,
      });
    }
    for (let i = 0; i < left; i++) {
      chairs.push({
        x: -(CHAIR_GAP + CHAIR_H / 2),
        y: (h / (left + 1)) * (i + 1),
        rotation: 90,
      });
    }
    for (let i = 0; i < right; i++) {
      chairs.push({
        x: w + CHAIR_GAP + CHAIR_H / 2,
        y: (h / (right + 1)) * (i + 1),
        rotation: 90,
      });
    }
  }

  return chairs;
}

export function ChairsSvgLayer({
  tables,
  canvasW,
  canvasH,
  occupiedTableNumbers,
}: {
  tables: FloorTable[];
  canvasW: number;
  canvasH: number;
  occupiedTableNumbers?: Set<number>;
}) {
  return (
    <svg
      width={canvasW}
      height={canvasH}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      {tables.map(table => {
        const chairs = getChairPositions(table.shape, table.capacity);
        const isOccupied = occupiedTableNumbers?.has(table.table_number) ?? false;
        const fill = isOccupied ? CHAIR_FILL_OCCUPIED : CHAIR_FILL;

        return chairs.map((chair, i) => (
          <rect
            key={`${table.id}-c${i}`}
            x={table.x + chair.x - CHAIR_W / 2}
            y={table.y + chair.y - CHAIR_H / 2}
            width={CHAIR_W}
            height={CHAIR_H}
            rx={CHAIR_RX}
            ry={CHAIR_RX}
            fill={fill}
            opacity={0.5}
            transform={`rotate(${chair.rotation} ${table.x + chair.x} ${table.y + chair.y})`}
          />
        ));
      })}
    </svg>
  );
}

// ─── Architectural walls ─────────────────────────────────────────────────────

export function WallsSvgLayer({
  walls,
  canvasW,
  canvasH,
  selectedWallId,
}: {
  walls: FloorWall[];
  canvasW: number;
  canvasH: number;
  selectedWallId?: string | null;
}) {
  if (walls.length === 0) return null;
  return (
    <svg
      width={canvasW}
      height={canvasH}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      <defs>
        <filter id="wall-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>
      {walls.map(wall => {
        const isSel = selectedWallId === wall.id;
        return (
          <g key={wall.id} filter={isSel ? undefined : 'url(#wall-shadow)'}>
            <polygon
              points={wall.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={isSel ? '#2563eb' : '#374151'}
              strokeWidth={isSel ? 10 : 9}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polygon
              points={wall.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={isSel ? '#3b82f6' : '#1f2937'}
              strokeWidth={isSel ? 6 : 5}
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
}: {
  doors: FloorDoor[];
  canvasW: number;
  canvasH: number;
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
          {/* Door panel */}
          <line
            x1={0} y1={0} x2={DOOR_LEN} y2={0}
            stroke="#4b5563"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Swing arc (quarter circle) */}
          <path
            d={`M ${DOOR_LEN} 0 A ${DOOR_LEN} ${DOOR_LEN} 0 0 1 0 ${DOOR_LEN}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {/* Pivot point */}
          <circle cx={0} cy={0} r={2.5} fill="#4b5563" />
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
