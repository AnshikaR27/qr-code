'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  X, Clock, CheckCheck, PlusCircle, IndianRupee, ReceiptText, Loader2, DoorOpen, Bell,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { useOrders } from '@/contexts/OrdersContext';
import { hasPermission } from '@/lib/staff-permissions';
import { cn, formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { playWaiterCall } from '@/lib/sounds';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
import { buildCombinedBillData } from '@/lib/billing';
import type {
  FloorCapacity,
  FloorPlan,
  FloorStyle,
  FloorTable,
  Order,
  WaiterCall,
  ZoneColor,
} from '@/types';

const GRID = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;

const TIMER_AMBER_MINUTES = 60;
const TIMER_RED_MINUTES = 120;

function tableLabelText(t: { table_number: number; display_name?: string | null }): string {
  return t.display_name?.trim() || `#${t.table_number}`;
}

function formatTimer(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timerColor(minutes: number): string {
  if (minutes >= TIMER_RED_MINUTES) return '#dc2626';
  if (minutes >= TIMER_AMBER_MINUTES) return '#d97706';
  return '#9ca3af';
}

function getOccupancyMinutes(tableOrders: Order[]): number {
  const earliest = tableOrders.reduce((min, o) => {
    const t = new Date(o.created_at).getTime();
    return t < min ? t : min;
  }, Infinity);
  if (earliest === Infinity) return 0;
  return Math.floor((Date.now() - earliest) / 60000);
}

function getOrderTotal(tableOrders: Order[]): number {
  return tableOrders.reduce((sum, o) => sum + o.total, 0);
}

function getProgressFraction(tableOrders: Order[]): number {
  let totalItems = 0;
  let readyItems = 0;
  for (const o of tableOrders) {
    if (o.status === 'ready') {
      const active = (o.items ?? []).filter(i => i.status !== 'voided');
      totalItems += active.reduce((s, i) => s + i.quantity, 0);
      readyItems += active.reduce((s, i) => s + i.quantity, 0);
    } else {
      const active = (o.items ?? []).filter(i => i.status !== 'voided');
      totalItems += active.reduce((s, i) => s + i.quantity, 0);
    }
  }
  if (totalItems === 0) return 0;
  return readyItems / totalItems;
}

function tableSize(capacity: FloorCapacity) {
  if (capacity <= 2) return { w: 70, h: 70 };
  if (capacity <= 4) return { w: 90, h: 90 };
  if (capacity <= 6) return { w: 130, h: 80 };
  return { w: 160, h: 80 };
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

type TableLiveStatus = 'available' | 'occupied' | 'ready_to_bill' | 'needs_attention';

const STATUS_COLORS: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', text: '#15803d', sub: '#16a34a' },
  occupied:        { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#b45309', sub: '#d97706' },
  ready_to_bill:   { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', text: '#6d28d9', sub: '#7c3aed' },
  needs_attention: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#b91c1c', sub: '#dc2626' },
};

const WAITER_PULSE_KEYFRAMES = `
@keyframes waiterPulseRing {
  0%   { transform: scale(1);   opacity: 0.7; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes waiterPulseRingReduced {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
`;

const ZONE_COLORS_MAP: Record<ZoneColor, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.30)', text: '#3b82f6' },
  green:  { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)',  text: '#22c55e' },
  orange: { bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.30)', text: '#f97316' },
  purple: { bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.30)', text: '#a855f7' },
  pink:   { bg: 'rgba(236,72,153,0.10)',  border: 'rgba(236,72,153,0.30)', text: '#ec4899' },
};

function getFloorBackground(style?: FloorStyle): React.CSSProperties {
  switch (style) {
    case 'wood':
      return {
        backgroundColor: '#f5e6d3',
        backgroundImage: [
          'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(139,90,43,0.04) 20px, rgba(139,90,43,0.04) 21px)',
          'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(139,90,43,0.03) 4px, rgba(139,90,43,0.03) 5px)',
        ].join(', '),
      };
    case 'tile':
      return {
        backgroundColor: '#f8f8f8',
        backgroundImage: 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      };
    case 'white':
      return { backgroundColor: '#ffffff' };
    case 'grey':
      return { backgroundColor: '#f3f4f6' };
    case 'dots':
    default:
      return {
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: `${GRID}px ${GRID}px`,
      };
  }
}

interface SelectedTable {
  dbId: string;
  label: string;
  orders: Order[];
}

export default function StaffTablesPage() {
  const { staff, restaurant } = useStaff();
  const { orders } = useOrders();
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [, setTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const prevWaiterCallCount = useRef(0);

  if (!hasPermission(staff.role, 'table:assign')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <p className="text-sm">You don&apos;t have access to this page.</p>
      </div>
    );
  }
  const plan: FloorPlan = restaurant.floor_plan ?? { tables: [], labels: [] };
  const [dbTableIds, setDbTableIds] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tables')
      .select('id, table_number')
      .eq('restaurant_id', restaurant.id)
      .then(({ data }) => {
        if (data) {
          setDbTableIds(new Map(data.map((r) => [r.table_number, r.id])));
        }
      });
  }, [restaurant.id]);

  // Fetch waiter calls + realtime subscription
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('waiter_calls')
      .select('*, table:tables(id, table_number)')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'pending')
      .then(({ data }) => { if (data) setWaiterCalls(data); });

    const channel = supabase
      .channel('staff-tables-waiter-calls')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          supabase
            .from('waiter_calls')
            .select('*, table:tables(id, table_number)')
            .eq('restaurant_id', restaurant.id)
            .eq('status', 'pending')
            .then(({ data }) => { if (data) setWaiterCalls(data); });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant.id]);

  // Play audio alert on new waiter call
  useEffect(() => {
    if (waiterCalls.length > prevWaiterCallCount.current && prevWaiterCallCount.current >= 0) {
      playWaiterCall();
    }
    prevWaiterCallCount.current = waiterCalls.length;
  }, [waiterCalls.length]);

  // Timer tick every 30 seconds to update occupancy durations
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled' && !o.payment_method
  );

  const waiterCallTableNumbers = new Set(
    waiterCalls.map(wc => wc.table?.table_number).filter((n): n is number => n != null),
  );

  function getTableStatus(tableNumber: number): { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean } {
    const tableOrders = activeOrders.filter((o) => o.table?.table_number === tableNumber);
    const hasWaiterCall = waiterCallTableNumbers.has(tableNumber);
    if (hasWaiterCall) return { status: 'needs_attention', orders: tableOrders, hasWaiterCall };
    if (tableOrders.length === 0) return { status: 'available', orders: [], hasWaiterCall: false };
    const allReady = tableOrders.every((o) => o.status === 'ready');
    if (allReady) return { status: 'ready_to_bill', orders: tableOrders, hasWaiterCall: false };
    return { status: 'occupied', orders: tableOrders, hasWaiterCall: false };
  }

  const dismissWaiterCall = useCallback(async (tableNumber: number) => {
    const call = waiterCalls.find(wc => wc.table?.table_number === tableNumber);
    if (!call) return;
    const supabase = createClient();
    await supabase.from('waiter_calls').update({ status: 'acknowledged' }).eq('id', call.id);
    setWaiterCalls(prev => prev.filter(wc => wc.id !== call.id));
    toast.success('Waiter call dismissed');
  }, [waiterCalls]);

  function handleTableClick(table: FloorTable, dbId: string, info: { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean }) {
    if (info.status === 'available') return;
    setSelectedTable({
      dbId,
      label: tableLabelText(table),
      orders: info.orders,
    });
  }

  // Keep modal orders in sync with live order updates
  useEffect(() => {
    if (!selectedTable) return;
    const freshOrders = activeOrders.filter(
      (o) => selectedTable.orders.some(so => o.table_id === so.table_id)
    );
    if (freshOrders.length === 0) {
      setSelectedTable(null);
    } else {
      setSelectedTable(prev => prev ? { ...prev, orders: freshOrders } : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  if (plan.tables.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Tables</h1>
          <p className="text-sm text-muted-foreground mt-1">Tap a table to view or place an order</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No tables found. Ask the owner to set up tables in the floor plan.
        </div>
      </div>
    );
  }

  const statusCounts = plan.tables.reduce(
    (acc, t) => { acc[getTableStatus(t.table_number).status]++; return acc; },
    { available: 0, occupied: 0, ready_to_bill: 0, needs_attention: 0 } as Record<TableLiveStatus, number>,
  );

  return (
    <div className="p-4 sm:p-6 pb-20 md:pb-2">
      {/* Inject waiter pulse keyframes */}
      <style dangerouslySetInnerHTML={{ __html: WAITER_PULSE_KEYFRAMES }} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
        <h1 className="text-lg font-semibold">Tables</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {([
            { key: 'available' as const, color: 'bg-green-500', textColor: 'text-green-700', label: 'available' },
            { key: 'occupied' as const, color: 'bg-amber-500', textColor: 'text-amber-700', label: 'occupied' },
            { key: 'ready_to_bill' as const, color: 'bg-violet-500', textColor: 'text-violet-700', label: 'ready to bill' },
            { key: 'needs_attention' as const, color: 'bg-red-500', textColor: 'text-red-700', label: 'attention' },
          ]).map(({ key, color, textColor, label }) => (
            statusCounts[key] > 0 ? (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className={`font-medium ${textColor}`}>{statusCounts[key]}</span>
                <span className="text-muted-foreground">{label}</span>
              </span>
            ) : null
          ))}
        </div>
      </div>

      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <StaffFloorCanvas
          plan={plan}
          getTableStatus={getTableStatus}
          dbTableIds={dbTableIds}
          onOccupiedTableClick={handleTableClick}
          reducedMotion={reducedMotion}
          onDismissWaiterCall={dismissWaiterCall}
        />
      </div>

      {selectedTable && (
        <TableOrdersModal
          table={selectedTable}
          restaurant={restaurant}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}

// ─── Floor Canvas ───────────────────────────────────────────────────────────

function StaffFloorCanvas({
  plan,
  getTableStatus,
  dbTableIds,
  onOccupiedTableClick,
  reducedMotion,
  onDismissWaiterCall,
}: {
  plan: FloorPlan;
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean };
  dbTableIds: Map<number, string>;
  onOccupiedTableClick: (table: FloorTable, dbId: string, info: { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean }) => void;
  reducedMotion: boolean;
  onDismissWaiterCall: (tableNumber: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ scale: 1, containerW: CANVAS_W });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    function update() {
      const rect = el.getBoundingClientRect();
      const availW = rect.width;
      const isMobile = window.innerWidth < 768;
      const availH = window.innerHeight - rect.top - (isMobile ? 76 : 12);
      const scaleX = availW / CANVAS_W;
      const scaleY = Math.max(100, availH) / CANVAS_H;
      setDims({ scale: Math.min(1, scaleX, scaleY), containerW: availW });
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const leftOffset = Math.max(0, (dims.containerW - CANVAS_W * dims.scale) / 2);

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', height: CANVAS_H * dims.scale, position: 'relative' }}>
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: 'absolute',
          left: leftOffset,
          top: 0,
          transform: `scale(${dims.scale})`,
          transformOrigin: 'top left',
          ...getFloorBackground(plan.floorStyle),
          userSelect: 'none',
        }}
      >
      {/* Layer 1: Zones */}
      {(plan.zones ?? []).map(zone => {
        const zc = ZONE_COLORS_MAP[zone.color];
        return (
          <div
            key={zone.id}
            style={{
              position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height,
              background: zc.bg, border: `1.5px dashed ${zc.border}`, borderRadius: 8,
              zIndex: 0, pointerEvents: 'none',
            }}
          >
            <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontWeight: 600, color: zc.text, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{zone.name}</span>
          </div>
        );
      })}

      {/* Layer 2: Walls */}
      {(plan.walls ?? []).length > 0 && (
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}>
          {(plan.walls ?? []).map(wall => (
            <polygon
              key={wall.id}
              points={wall.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#1f2937"
              strokeWidth={7}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}

      {/* Layer 3: Counter */}
      {plan.counter && (
        <div
          style={{
            position: 'absolute', left: plan.counter.x, top: plan.counter.y,
            width: plan.counter.width, height: plan.counter.height,
            background: 'repeating-linear-gradient(45deg, #6b7280, #6b7280 2px, #9ca3af 2px, #9ca3af 6px)',
            borderRadius: 6, border: '2px solid #4b5563',
            zIndex: 1, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Counter</span>
        </div>
      )}

      {/* Layer 4: Doors */}
      {(plan.doors ?? []).map(door => (
        <div
          key={door.id}
          style={{
            position: 'absolute', left: door.x - 18, top: door.y - 18, width: 36, height: 36,
            background: 'rgba(255,255,255,0.9)',
            border: '1.5px solid #6b7280', borderRadius: 8,
            zIndex: 1, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <DoorOpen className="w-5 h-5 text-gray-600" />
        </div>
      ))}

      {/* Layer 5: Labels */}
      {plan.labels.map((label) => (
        <div
          key={label.id}
          style={{
            position: 'absolute',
            left: label.x,
            top: label.y,
            zIndex: 1,
          }}
        >
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 5,
              background: 'rgba(0,0,0,0.05)',
              border: '1.5px dashed #94a3b8',
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {label.text}
          </div>
        </div>
      ))}

      {/* Layer 6: Merge group backgrounds */}
      <MergeGroupBackgrounds tables={plan.tables} getTableStatus={getTableStatus} />

      {/* Layer 7: Tables */}
      {plan.tables.map((table) => {
        const info = getTableStatus(table.table_number);
        const dbId = dbTableIds.get(table.table_number) ?? table.id;
        return (
          <StaffTableElement
            key={table.id}
            table={table}
            status={info.status}
            orders={info.orders}
            dbId={dbId}
            hasWaiterCall={info.hasWaiterCall}
            reducedMotion={reducedMotion}
            onOccupiedClick={() => {
              if (info.hasWaiterCall) onDismissWaiterCall(table.table_number);
              onOccupiedTableClick(table, dbId, info);
            }}
          />
        );
      })}
      </div>
    </div>
  );
}

// ─── Table Element ──────────────────────────────────────────────────────────

function StaffTableElement({
  table,
  status,
  orders: tableOrders,
  dbId,
  hasWaiterCall,
  reducedMotion,
  onOccupiedClick,
}: {
  table: FloorTable;
  status: TableLiveStatus;
  orders: Order[];
  dbId: string;
  hasWaiterCall: boolean;
  reducedMotion: boolean;
  onOccupiedClick: () => void;
}) {
  const { w, h } = tableSize(table.capacity);
  const isRound = table.shape === 'round';
  const colors = STATUS_COLORS[status];
  const customerName = tableOrders.find((o) => o.customer_name)?.customer_name ?? null;
  const inMergeGroup = !!table.merge_group_id;
  const showName = customerName && !inMergeGroup;
  const isOccupied = tableOrders.length > 0;

  const minutes = isOccupied ? getOccupancyMinutes(tableOrders) : 0;
  const total = isOccupied ? getOrderTotal(tableOrders) : 0;
  const progress = isOccupied ? getProgressFraction(tableOrders) : 0;
  const isSmall = table.capacity <= 2;

  const progressColor = progress >= 1 ? '#22c55e' : '#f59e0b';

  const inner = (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: isRound ? '50%' : 10,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        padding: '0 4px',
        position: 'relative' as const,
        overflow: 'hidden',
      }}
      className="hover:shadow-lg hover:scale-105"
    >
      {/* Waiter call bell icon */}
      {hasWaiterCall && (
        <Bell
          className="absolute"
          style={{ top: 3, right: isRound ? 8 : 4, width: 12, height: 12, color: '#ef4444' }}
        />
      )}

      {/* Table label */}
      <span style={{ fontWeight: 700, fontSize: 13, color: colors.text, lineHeight: 1 }}>
        {tableLabelText(table)}
      </span>

      {/* Customer name or capacity */}
      {showName ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: colors.text,
            marginTop: 2,
            lineHeight: 1.1,
            maxWidth: 'calc(100% - 8px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {shortName(customerName)}
        </span>
      ) : !isOccupied ? (
        <span style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>
          {table.capacity}p
        </span>
      ) : null}

      {/* Timer — hide on small tables to save space */}
      {isOccupied && !isSmall && minutes > 0 && (
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: timerColor(minutes),
          marginTop: 1,
          lineHeight: 1,
        }}>
          {formatTimer(minutes)}
        </span>
      )}

      {/* Order value */}
      {isOccupied && total > 0 && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.text,
          marginTop: 1,
          lineHeight: 1,
        }}>
          {formatPrice(total)}
        </span>
      )}
    </div>
  );

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: table.x,
    top: table.y,
    width: w,
    height: h,
    cursor: 'pointer',
    zIndex: 2,
    display: 'block',
    textDecoration: 'none',
  };

  const progressRing = isOccupied && progress > 0 ? (
    <svg
      style={{
        position: 'absolute',
        top: -3,
        left: -3,
        width: w + 6,
        height: h + 6,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {isRound ? (
        <circle
          cx={(w + 6) / 2}
          cy={(h + 6) / 2}
          r={(w + 6) / 2 - 2}
          fill="none"
          stroke={progressColor}
          strokeWidth={2.5}
          strokeDasharray={`${progress * Math.PI * (w + 2)} ${Math.PI * (w + 2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${(w + 6) / 2} ${(h + 6) / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }}
        />
      ) : (
        <rect
          x={2}
          y={2}
          width={w + 2}
          height={h + 2}
          rx={12}
          ry={12}
          fill="none"
          stroke={progressColor}
          strokeWidth={2.5}
          strokeDasharray={`${progress * 2 * (w + h + 4)} ${2 * (w + h + 4)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }}
        />
      )}
    </svg>
  ) : null;

  const waiterPulse = hasWaiterCall && !reducedMotion ? (
    <div
      style={{
        position: 'absolute',
        inset: -4,
        borderRadius: isRound ? '50%' : 14,
        border: '2px solid rgba(239,68,68,0.6)',
        animation: 'waiterPulseRing 1.5s ease-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  ) : hasWaiterCall && reducedMotion ? (
    <div
      style={{
        position: 'absolute',
        inset: -4,
        borderRadius: isRound ? '50%' : 14,
        border: '2px solid rgba(239,68,68,0.6)',
        animation: 'waiterPulseRingReduced 2s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  ) : null;

  if (status === 'available') {
    return (
      <Link href={`/staff-dashboard/tables/${dbId}/new-order`} style={positionStyle}>
        {progressRing}
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOccupiedClick} style={{ ...positionStyle, overflow: 'visible' }}>
      {waiterPulse}
      {progressRing}
      {inner}
    </button>
  );
}

// ─── Table Orders Modal ─────────────────────────────────────────────────────

function TableOrdersModal({
  table,
  restaurant,
  onClose,
}: {
  table: SelectedTable;
  restaurant: import('@/types').Restaurant;
  onClose: () => void;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [billingOrders, setBillingOrders] = useState<Order[] | null>(null);

  const totalAmount = table.orders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = table.orders.reduce(
    (sum, o) => sum + (o.items ?? []).filter(i => i.status !== 'voided').reduce((s, i) => s + i.quantity, 0),
    0,
  );

  const allReady = table.orders.every(o => o.status === 'ready');
  const somePrepping = table.orders.some(o => o.status === 'placed');
  const preppingOrders = table.orders.filter(o => o.status === 'placed');

  const sortedOrders = [...table.orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  async function handleMarkAllReady() {
    setUpdating('all');
    try {
      await Promise.all(
        preppingOrders.map(order =>
          fetch(`/api/staff/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ready' }),
          }),
        ),
      );
      toast.success(totalItems === 1 ? 'Order marked ready' : 'All items marked ready');
      const isTableService = restaurant.service_mode === 'table_service';
      preppingOrders.forEach(order => {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            title: isTableService ? 'Your food is on its way!' : 'Your order is ready!',
            body: isTableService
              ? `Order #${order.order_number} — your food is being brought to your table.`
              : `Order #${order.order_number} — please collect from the counter`,
            url: `/${restaurant.slug}/order/${order.id}`,
          }),
        }).catch(() => {});
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  }

  async function handlePrintBill(billOrders: Order[]) {
    const config = restaurant.billing_config;
    const printerConf = restaurant.printer_config;
    if (!config?.gstin && !config?.legal_name) {
      toast.error('Set up Tax & Billing in Settings first');
      return;
    }

    const orderData = buildCombinedBillData(billOrders);

    if (printerConf?.bill_printer) {
      const printer = printerConf.printers.find(p => p.id === printerConf.bill_printer);
      if (printer && printer.type !== 'browser') {
        const { printerService } = await import('@/lib/printer-service');
        const { buildBillReceipt } = await import('@/lib/escpos-bill');
        const copies = printerConf.copies_bill ?? 1;
        const data = buildBillReceipt(orderData, restaurant.name, restaurant.phone ?? null, config!, printer.paper_width, false);
        const result = await printerService.print(printer, data);
        if (result.success) {
          if (copies === 2) {
            const dup = buildBillReceipt(orderData, restaurant.name, restaurant.phone ?? null, config!, printer.paper_width, true);
            await printerService.print(printer, dup);
          }
          return;
        }
        if (result.error !== 'Use browser fallback') return;
      }
    }

    const { printCustomerBill } = await import('@/lib/billing');
    printCustomerBill(orderData, restaurant, config!);
  }

  async function handleBillingConfirm(orderIds: string[], data: BillingConfirmData) {
    setBillingOrders(null);
    setUpdating(orderIds[0]);
    try {
      const res = await fetch('/api/staff/orders/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: orderIds,
          payment_method: data.payment_method,
          payment_methods: data.payment_methods,
          discount_amount: data.discount_amount,
          discount_type: data.discount_type,
          discount_before_tax: data.discount_before_tax,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to record payment');
      }
      toast.success(`Payment recorded — ${data.payment_method.toUpperCase()}`);

      const billedOrders = orderIds.map(id => table.orders.find(o => o.id === id)).filter(Boolean) as Order[];
      if (billedOrders.length > 0 && restaurant.printer_config?.auto_print_bill) {
        try { await handlePrintBill(billedOrders); } catch { /* silent */ }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setUpdating(null);
    }
  }

  async function handleCloseTable() {
    const orderIds = table.orders.map(o => o.id);
    setUpdating(orderIds[0]);
    try {
      const res = await fetch('/api/staff/orders/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds, payment_method: 'cash' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to close table');
      }
      toast.success(`Table ${table.label} closed`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close table');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="font-bold text-lg">Table {table.label}</h2>
              <p className="text-sm text-muted-foreground">
                {totalItems} item{totalItems !== 1 ? 's' : ''} · {formatPrice(totalAmount)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePrintBill(table.orders)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Print Bill"
              >
                <ReceiptText className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Unified item list grouped by round */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {sortedOrders.map((order, idx) => {
              const activeItems = (order.items ?? []).filter(i => i.status !== 'voided');
              if (activeItems.length === 0) return null;
              const isReady = order.status === 'ready';
              const roundNum = idx + 1;
              const names = [order.customer_name].filter(Boolean);

              return (
                <div key={order.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Round {roundNum}
                    </span>
                    {names.length > 0 && (
                      <span className="text-xs text-muted-foreground">· {names.join(', ')}</span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      · <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto',
                      isReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      {isReady ? 'READY' : 'PREP'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeItems.map((item) => {
                      const addonTotal = (item.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
                      return (
                        <div key={item.id}>
                          <div className="flex justify-between gap-2">
                            <span className="text-sm">
                              <span className="font-semibold">{item.quantity}×</span> {item.name}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatPrice((item.price + addonTotal) * item.quantity)}
                            </span>
                          </div>
                          {(item.selected_addons ?? []).map((addon, ai) => (
                            <div key={ai} className="flex justify-between gap-2 pl-5">
                              <span className="text-xs text-muted-foreground">+ {addon.name}</span>
                              {addon.price > 0 && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">+{formatPrice(addon.price)}</span>
                              )}
                            </div>
                          ))}
                          {item.notes && (
                            <p className="text-xs text-red-600 font-medium mt-0.5 italic pl-5">&ldquo;{item.notes}&rdquo;</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t space-y-2">
            {somePrepping && (
              <button
                onClick={handleMarkAllReady}
                disabled={!!updating}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updating === 'all' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCheck className="w-5 h-5" />
                )}
                {totalItems === 1 ? 'Mark Ready' : 'Mark All Ready'}
              </button>
            )}
            <button
              onClick={() => setBillingOrders(table.orders)}
              disabled={!!updating || !allReady}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50',
                allReady
                  ? 'text-white bg-violet-600 hover:bg-violet-700'
                  : 'text-violet-400 bg-violet-50 border border-violet-200 cursor-not-allowed',
              )}
            >
              <IndianRupee className="w-5 h-5" />
              Collect {formatPrice(totalAmount)}
            </button>
            <button
              onClick={() => { onClose(); router.push(`/staff-dashboard/tables/${table.dbId}/new-order?round=${table.orders.length + 1}`); }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Add items · Round {table.orders.length + 1}
            </button>
            <button
              onClick={handleCloseTable}
              disabled={!!updating}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 py-1"
            >
              Already settled — close table
            </button>
          </div>
        </div>
      </div>

      <BillingSheet
        orders={billingOrders}
        restaurant={restaurant}
        onConfirm={handleBillingConfirm}
        onClose={() => setBillingOrders(null)}
      />
    </>
  );
}

// ─── Merge Group Backgrounds ────────────────────────────────────────────────

function MergeGroupBackgrounds({
  tables,
  getTableStatus,
}: {
  tables: FloorTable[];
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean };
}) {
  const groups = new Map<string, FloorTable[]>();
  for (const t of tables) {
    if (!t.merge_group_id) continue;
    const list = groups.get(t.merge_group_id) ?? [];
    list.push(t);
    groups.set(t.merge_group_id, list);
  }

  const rects: React.ReactNode[] = [];
  const PAD = 10;

  groups.forEach((groupTables, groupId) => {
    if (groupTables.length < 2) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalSeats = 0;
    let groupCustomerName: string | null = null;
    for (const t of groupTables) {
      const s = tableSize(t.capacity);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + s.w);
      maxY = Math.max(maxY, t.y + s.h);
      totalSeats += t.capacity;
      if (!groupCustomerName) {
        const info = getTableStatus(t.table_number);
        groupCustomerName = info.orders.find((o) => o.customer_name)?.customer_name ?? null;
      }
    }

    const headerParts = [`Merged · ${groupTables.length} tables · ${totalSeats} seats`];
    if (groupCustomerName) headerParts.push(`· ${shortName(groupCustomerName)}`);

    rects.push(
      <div
        key={groupId}
        style={{
          position: 'absolute',
          left: minX - PAD,
          top: minY - PAD - 16,
          width: maxX - minX + PAD * 2,
          height: maxY - minY + PAD * 2 + 16,
          borderRadius: 14,
          background: 'rgba(139,92,246,0.06)',
          border: '1.5px solid rgba(139,92,246,0.2)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 8,
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(139,92,246,0.55)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {headerParts.join(' ')}
        </div>
      </div>,
    );
  });

  if (rects.length === 0) return null;
  return <>{rects}</>;
}
