'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  X, Clock, CheckCheck, PlusCircle, IndianRupee, ReceiptText, Loader2, Bell,
  Search, Users, ArrowRight, Maximize2, Minimize2,
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
import NewOrderDrawer from '@/components/dashboard/NewOrderDrawer';
import {
  WallsSvgLayer,
  CounterElement,
  DoorArcsSvgLayer,
  isOutdoorZone,
  OUTDOOR_PATTERN_CSS,
  TABLE_DROP_SHADOW,
} from '@/components/floor-plan/floor-plan-decorations';
import type {
  FloorCapacity,
  FloorPlan,
  FloorStyle,
  FloorTable,
  Order,
  WaiterCall,
  ZoneColor,
} from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;
const CONTENT_PAD = 35;
const DOOR_LEN = 28;
const ZONE_EXPAND = 12;

const TIMER_AMBER_MINUTES = 60;
const TIMER_RED_MINUTES = 120;

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;
const HOVER_DELAY_MS = 300;
const SEAT_PARTY_TIMEOUT_MS = 30_000;

// ─── Utilities ───────────────────────────────────────────────────────────────

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

function getStatusSummary(tableOrders: Order[]): string {
  const placed = tableOrders.filter(o => o.status === 'placed').length;
  const ready = tableOrders.filter(o => o.status === 'ready').length;
  if (placed === 0 && ready > 0) return 'All ready';
  const parts: string[] = [];
  if (placed > 0) parts.push(`${placed} preparing`);
  if (ready > 0) parts.push(`${ready} ready`);
  return parts.join(', ') || 'Placed';
}

function getTableAtPoint(x: number, y: number, tables: FloorTable[], boost = 1): FloorTable | null {
  for (const t of tables) {
    const { w: bw, h: bh } = tableSize(t.capacity);
    const w = bw * boost, h = bh * boost;
    const ox = t.x - (w - bw) / 2, oy = t.y - (h - bh) / 2;
    if (x >= ox && x <= ox + w && y >= oy && y <= oy + h) return t;
  }
  return null;
}

function computeContentBounds(plan: FloorPlan): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function expand(x: number, y: number, w = 0, h = 0) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  for (const t of plan.tables) {
    const s = tableSize(t.capacity);
    expand(t.x, t.y, s.w, s.h + 22);
  }

  for (const w of plan.walls ?? []) {
    for (const p of w.points) expand(p.x, p.y);
  }

  if (plan.counter) {
    const c = plan.counter;
    expand(c.x, c.y, c.width, c.height);
  }

  for (const z of plan.zones ?? []) {
    expand(z.x, z.y, z.width, z.height);
  }

  for (const d of plan.doors ?? []) {
    expand(d.x - DOOR_LEN, d.y - DOOR_LEN, DOOR_LEN * 2, DOOR_LEN * 2);
  }

  for (const l of plan.labels) {
    expand(l.x, l.y, 120, 30);
  }

  if (minX === Infinity) return { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };
  return { minX, minY, maxX, maxY };
}

// ─── Status types ────────────────────────────────────────────────────────────

type TableLiveStatus = 'available' | 'occupied' | 'ready_to_bill' | 'needs_attention';

const STATUS_COLORS_LIGHT: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', text: '#15803d', sub: '#16a34a' },
  occupied:        { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#b45309', sub: '#d97706' },
  ready_to_bill:   { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', text: '#6d28d9', sub: '#7c3aed' },
  needs_attention: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#b91c1c', sub: '#dc2626' },
};

const STATUS_COLORS_DARK: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.20)',  border: '#22c55e', text: '#86efac', sub: '#4ade80' },
  occupied:        { bg: 'rgba(245,158,11,0.22)', border: '#f59e0b', text: '#fde68a', sub: '#fbbf24' },
  ready_to_bill:   { bg: 'rgba(139,92,246,0.20)', border: '#a78bfa', text: '#c4b5fd', sub: '#a78bfa' },
  needs_attention: { bg: 'rgba(239,68,68,0.22)',  border: '#f87171', text: '#fca5a5', sub: '#f87171' },
};

const INJECTED_STYLES = `
@keyframes waiterPulseRing {
  0%   { transform: scale(1);   opacity: 0.7; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes waiterPulseRingReduced {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
@keyframes dragLift {
  0%   { transform: scale(1);   box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
  100% { transform: scale(1.08); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
}
@keyframes dropTargetGlow {
  0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }
  50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0.15); }
}
@keyframes recommendPulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.3); }
  50%      { box-shadow: 0 0 0 6px rgba(59,130,246,0.15); }
}
@keyframes mergeSlideLeft {
  0%   { transform: translateX(0); }
  100% { transform: translateX(24px); }
}
@keyframes mergeSlideRight {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-24px); }
}
@keyframes mergePulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50%      { transform: scale(1.15); opacity: 1; }
}
@keyframes mergeDialogIn {
  0%   { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
`;

const ZONE_COLORS_LIGHT: Record<ZoneColor, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.30)', text: '#3b82f6' },
  green:  { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)',  text: '#22c55e' },
  orange: { bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.30)', text: '#f97316' },
  purple: { bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.30)', text: '#a855f7' },
  pink:   { bg: 'rgba(236,72,153,0.10)',  border: 'rgba(236,72,153,0.30)', text: '#ec4899' },
};

const ZONE_COLORS_DARK: Record<ZoneColor, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(96,165,250,0.35)', text: '#93bbfd' },
  green:  { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(74,222,128,0.35)', text: '#86efac' },
  orange: { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(251,146,60,0.35)', text: '#fdba74' },
  purple: { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(196,181,253,0.35)', text: '#c4b5fd' },
  pink:   { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(244,114,182,0.35)', text: '#f9a8d4' },
};

function isDarkFloor(style?: FloorStyle): boolean {
  return style === 'darkwood' || style === 'charcoal' || style === 'midnight';
}

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
    case 'darkwood':
      return {
        backgroundColor: '#2a1f17',
        backgroundImage: [
          'repeating-linear-gradient(90deg, transparent, transparent 22px, rgba(210,160,100,0.06) 22px, rgba(210,160,100,0.06) 23px)',
          'repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(210,160,100,0.04) 5px, rgba(210,160,100,0.04) 6px)',
        ].join(', '),
      };
    case 'charcoal':
      return {
        backgroundColor: '#1a1a1a',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      };
    case 'midnight':
      return {
        backgroundColor: '#0f172a',
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.12) 1px, transparent 1px)',
        backgroundSize: `${GRID}px ${GRID}px`,
      };
    case 'dots':
    default:
      return {
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: `${GRID}px ${GRID}px`,
      };
  }
}

// ─── Drag state ──────────────────────────────────────────────────────────────

interface DragState {
  sourceTable: FloorTable;
  sourceDbId: string;
  sourceOrders: Order[];
  cursorX: number;
  cursorY: number;
}

// ─── Selected table for modal ────────────────────────────────────────────────

interface SelectedTable {
  dbId: string;
  label: string;
  orders: Order[];
}

// ─── Merge dialog state ──────────────────────────────────────────────────────

interface MergeDialogState {
  sourceTable: FloorTable;
  sourceDbId: string;
  sourceOrders: Order[];
  destTable: FloorTable;
  destDbId: string;
  destOrders: Order[];
}

// ─── Seat party recommendation ───────────────────────────────────────────────

interface SeatPartyState {
  partySize: number;
  recommendedId: string | null;
  validIds: Set<string>;
}

function rankTablesForParty(
  tables: FloorTable[],
  partySize: number,
  getStatus: (tn: number) => { status: TableLiveStatus },
  counterPos?: { x: number; y: number } | null,
): { recommended: FloorTable | null; validIds: Set<string> } {
  const available = tables.filter(t => getStatus(t.table_number).status === 'available' && t.capacity >= partySize);
  if (available.length === 0) return { recommended: null, validIds: new Set() };

  const validIds = new Set(available.map(t => t.id));
  const hour = new Date().getHours();
  const preferOutdoor = hour >= 17;

  const scored = available.map(t => {
    let score = 0;
    const fit = t.capacity - partySize;
    score -= fit * 10;
    if (counterPos) {
      const dist = Math.hypot(t.x - counterPos.x, t.y - counterPos.y);
      if (partySize <= 2) score -= dist * 0.01;
      else if (partySize >= 5) score += dist * 0.005;
    }
    return { table: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return { recommended: scored[0]?.table ?? null, validIds };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function StaffTablesPage() {
  const { staff, restaurant } = useStaff();
  const { orders } = useOrders();
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [newOrderTable, setNewOrderTable] = useState<{ dbId: string; label: string; round?: number } | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [, setTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const prevWaiterCallCount = useRef(0);

  // Feature 5: Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Feature 6: Seat party
  const [seatParty, setSeatParty] = useState<SeatPartyState | null>(null);
  const seatPartyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Feature 2/3: Drag state + merge dialog
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mergeDialog, setMergeDialog] = useState<MergeDialogState | null>(null);
  const mergeHistoryRef = useRef<Map<string, { tableId: string; tableNumber: number }>>(new Map());

  const canDragMove = hasPermission(staff.role, 'table:move');

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

  useEffect(() => {
    if (waiterCalls.length > prevWaiterCallCount.current && prevWaiterCallCount.current >= 0) {
      playWaiterCall();
    }
    prevWaiterCallCount.current = waiterCalls.length;
  }, [waiterCalls.length]);

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
    setSelectedTable({ dbId, label: tableLabelText(table), orders: info.orders });
  }

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

  // ── Feature 2/3: Drag handlers ────────────────────────────────────────────

  const handleMoveOrders = useCallback(async (
    sourceOrders: Order[],
    sourceTableNumber: number,
    destDbId: string,
    destLabel: string,
    sourceLabel: string,
  ) => {
    const supabase = createClient();
    const orderIds = sourceOrders.map(o => o.id);
    const { error } = await supabase
      .from('orders')
      .update({ table_id: destDbId })
      .in('id', orderIds);
    if (error) {
      toast.error('Failed to move orders');
      return;
    }
    const wcs = waiterCalls.filter(wc => wc.table?.table_number === sourceTableNumber);
    if (wcs.length > 0) {
      await supabase
        .from('waiter_calls')
        .update({ table_id: destDbId })
        .in('id', wcs.map(w => w.id));
    }
    const customerName = sourceOrders.find(o => o.customer_name)?.customer_name;
    toast.success(`Moved ${customerName ? shortName(customerName) : 'orders'} from ${sourceLabel} → ${destLabel}`);
  }, [waiterCalls]);

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeDialog) return;
    const { sourceOrders, sourceTable, destDbId, destTable } = mergeDialog;
    const supabase = createClient();
    const orderIds = sourceOrders.map(o => o.id);
    for (const oid of orderIds) {
      mergeHistoryRef.current.set(oid, {
        tableId: mergeDialog.sourceDbId,
        tableNumber: sourceTable.table_number,
      });
    }
    const { error } = await supabase
      .from('orders')
      .update({ table_id: destDbId })
      .in('id', orderIds);
    if (error) {
      toast.error('Failed to merge tables');
      setMergeDialog(null);
      return;
    }
    toast.success(`Merged Table ${tableLabelText(sourceTable)} into Table ${tableLabelText(destTable)}`);
    setMergeDialog(null);
  }, [mergeDialog]);

  const handleDragDrop = useCallback((targetTable: FloorTable) => {
    if (!dragState) return;
    const targetDbId = dbTableIds.get(targetTable.table_number) ?? targetTable.id;
    const targetInfo = getTableStatus(targetTable.table_number);

    if (targetInfo.status === 'available') {
      handleMoveOrders(
        dragState.sourceOrders,
        dragState.sourceTable.table_number,
        targetDbId,
        tableLabelText(targetTable),
        tableLabelText(dragState.sourceTable),
      );
    } else {
      setMergeDialog({
        sourceTable: dragState.sourceTable,
        sourceDbId: dragState.sourceDbId,
        sourceOrders: dragState.sourceOrders,
        destTable: targetTable,
        destDbId: targetDbId,
        destOrders: targetInfo.orders,
      });
    }
    setDragState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, dbTableIds, handleMoveOrders]);

  // ── Feature 6: Seat party ─────────────────────────────────────────────────

  function startSeatParty(size: number) {
    if (seatPartyTimer.current) clearTimeout(seatPartyTimer.current);
    const counterPos = plan.counter ? { x: plan.counter.x + plan.counter.width / 2, y: plan.counter.y + plan.counter.height / 2 } : null;
    const { recommended, validIds } = rankTablesForParty(plan.tables, size, getTableStatus, counterPos);
    setSeatParty({ partySize: size, recommendedId: recommended?.id ?? null, validIds });
    seatPartyTimer.current = setTimeout(() => setSeatParty(null), SEAT_PARTY_TIMEOUT_MS);
  }

  function dismissSeatParty() {
    setSeatParty(null);
    if (seatPartyTimer.current) clearTimeout(seatPartyTimer.current);
  }

  // ── Computed search/highlight sets ────────────────────────────────────────

  const searchTerm = searchQuery.trim().toLowerCase();
  const searchMatchIds = useMemo(() => {
    if (!searchTerm) return new Set<string>();
    const ids = new Set<string>();
    for (const t of plan.tables) {
      const info = getTableStatus(t.table_number);
      const name = info.orders.find(o => o.customer_name)?.customer_name ?? '';
      const label = tableLabelText(t).toLowerCase();
      const num = String(t.table_number);
      if (
        name.toLowerCase().includes(searchTerm) ||
        label.includes(searchTerm) ||
        num.includes(searchTerm)
      ) {
        ids.add(t.id);
      }
    }
    return ids;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, plan.tables, activeOrders]);

  // ── Render ────────────────────────────────────────────────────────────────

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

  const header = (
    <div className={cn(
      'flex flex-wrap items-center justify-between gap-x-4 gap-y-1',
      isFullscreen ? 'px-4 py-2 bg-white/90 backdrop-blur-sm border-b' : 'px-4 sm:px-6 mb-1',
    )}>
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Tables</h1>

        {/* Feature 6: Seat party button */}
        <SeatPartyButton
          active={!!seatParty}
          onSelectSize={startSeatParty}
          onDismiss={dismissSeatParty}
          noTablesMsg={seatParty && seatParty.validIds.size === 0
            ? `No tables for ${seatParty.partySize} guests`
            : null
          }
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Feature 5: Search */}
        <div className="flex items-center">
          {searchOpen ? (
            <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1 shadow-sm">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Customer or table…"
                className="w-32 text-xs outline-none bg-transparent"
              />
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="p-0.5 hover:bg-gray-100 rounded">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Search tables"
            >
              <Search className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen(f => !f)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen
            ? <Minimize2 className="w-4 h-4 text-muted-foreground" />
            : <Maximize2 className="w-4 h-4 text-muted-foreground" />
          }
        </button>

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {([
            { key: 'available' as const, color: 'bg-green-500', textColor: 'text-green-700', label: 'available' },
            { key: 'occupied' as const, color: 'bg-amber-500', textColor: 'text-amber-700', label: 'occupied' },
            { key: 'ready_to_bill' as const, color: 'bg-violet-500', textColor: 'text-violet-700', label: 'ready' },
            { key: 'needs_attention' as const, color: 'bg-red-500', textColor: 'text-red-700', label: 'attention' },
          ]).map(({ key, color, textColor, label }) => (
            statusCounts[key] > 0 ? (
              <span key={key} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className={`font-medium ${textColor}`}>{statusCounts[key]}</span>
                <span className="text-muted-foreground hidden sm:inline">{label}</span>
              </span>
            ) : null
          ))}
        </div>
      </div>
    </div>
  );

  const canvas = (
    <StaffFloorCanvas
      plan={plan}
      getTableStatus={getTableStatus}
      dbTableIds={dbTableIds}
      onOccupiedTableClick={handleTableClick}
      onAvailableTableClick={(table, dbId) => {
        if (seatParty) dismissSeatParty();
        setNewOrderTable({ dbId, label: tableLabelText(table) });
      }}
      reducedMotion={reducedMotion}
      onDismissWaiterCall={dismissWaiterCall}
      canDrag={canDragMove}
      dragState={dragState}
      onDragStart={(table, dbId, tableOrders) => setDragState({ sourceTable: table, sourceDbId: dbId, sourceOrders: tableOrders, cursorX: 0, cursorY: 0 })}
      onDragMove={(x, y) => setDragState(prev => prev ? { ...prev, cursorX: x, cursorY: y } : null)}
      onDragEnd={handleDragDrop}
      onDragCancel={() => setDragState(null)}
      searchMatchIds={searchTerm ? searchMatchIds : null}
      seatParty={seatParty}
      isFullscreen={isFullscreen}
    />
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-40 bg-white flex flex-col">
        <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
        {header}
        <div className="flex-1 overflow-hidden">
          {canvas}
        </div>

        {selectedTable && (
          <TableOrdersModal
            table={selectedTable}
            restaurant={restaurant}
            onClose={() => setSelectedTable(null)}
            onAddItems={(tableId, tableLabel, round) => setNewOrderTable({ dbId: tableId, label: tableLabel, round })}
            mergeHistory={mergeHistoryRef.current}
            allTables={plan.tables}
            dbTableIds={dbTableIds}
          />
        )}

        {newOrderTable && (
          <NewOrderDrawer
            tableId={newOrderTable.dbId}
            tableLabel={newOrderTable.label}
            round={newOrderTable.round}
            onClose={() => setNewOrderTable(null)}
            onOrderPlaced={() => setNewOrderTable(null)}
          />
        )}

        {mergeDialog && (
          <MergeConfirmDialog
            source={mergeDialog}
            onConfirm={handleMergeConfirm}
            onCancel={() => setMergeDialog(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      {header}
      {canvas}

      {selectedTable && (
        <TableOrdersModal
          table={selectedTable}
          restaurant={restaurant}
          onClose={() => setSelectedTable(null)}
          onAddItems={(tableId, tableLabel, round) => setNewOrderTable({ dbId: tableId, label: tableLabel, round })}
          mergeHistory={mergeHistoryRef.current}
          allTables={plan.tables}
          dbTableIds={dbTableIds}
        />
      )}

      {newOrderTable && (
        <NewOrderDrawer
          tableId={newOrderTable.dbId}
          tableLabel={newOrderTable.label}
          round={newOrderTable.round}
          onClose={() => setNewOrderTable(null)}
          onOrderPlaced={() => setNewOrderTable(null)}
        />
      )}

      {/* Feature 3: Merge confirmation dialog */}
      {mergeDialog && (
        <MergeConfirmDialog
          source={mergeDialog}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeDialog(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR CANVAS
// ═══════════════════════════════════════════════════════════════════════════════

function StaffFloorCanvas({
  plan,
  getTableStatus,
  dbTableIds,
  onOccupiedTableClick,
  onAvailableTableClick,
  reducedMotion,
  onDismissWaiterCall,
  canDrag,
  dragState,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  searchMatchIds,
  seatParty,
  isFullscreen,
}: {
  plan: FloorPlan;
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean };
  dbTableIds: Map<number, string>;
  onOccupiedTableClick: (table: FloorTable, dbId: string, info: { status: TableLiveStatus; orders: Order[]; hasWaiterCall: boolean }) => void;
  onAvailableTableClick: (table: FloorTable, dbId: string) => void;
  reducedMotion: boolean;
  onDismissWaiterCall: (tableNumber: number) => void;
  canDrag: boolean;
  dragState: DragState | null;
  onDragStart: (table: FloorTable, dbId: string, orders: Order[]) => void;
  onDragMove: (canvasX: number, canvasY: number) => void;
  onDragEnd: (targetTable: FloorTable) => void;
  onDragCancel: () => void;
  searchMatchIds: Set<string> | null;
  seatParty: SeatPartyState | null;
  isFullscreen?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ scale: 1, containerW: CANVAS_W, containerH: CANVAS_H });

  const contentBounds = useMemo(() => computeContentBounds(plan), [plan]);
  const pad = isFullscreen ? 10 : CONTENT_PAD;
  const contentW = contentBounds.maxX - contentBounds.minX + pad * 2;
  const contentH = contentBounds.maxY - contentBounds.minY + pad * 2;

  // Feature 4: Hover peek
  const [peekTable, setPeekTable] = useState<{ table: FloorTable; orders: Order[]; screenX: number; screenY: number } | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag long-press
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    function update() {
      const rect = el.getBoundingClientRect();
      const availW = rect.width;
      const availH = rect.height;
      const scaleX = availW / contentW;
      const scaleY = Math.max(100, availH) / contentH;
      setDims({ scale: Math.min(scaleX, scaleY), containerW: availW, containerH: availH });
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [isFullscreen, contentW, contentH]);

  const leftOffset = Math.max(0, (dims.containerW - contentW * dims.scale) / 2);

  const contentOffsetX = -contentBounds.minX + pad;
  const contentOffsetY = -contentBounds.minY + pad;

  const topOffset = Math.max(0, (dims.containerH - contentH * dims.scale) / 2);

  const tableBoost = dims.scale > 1 ? Math.min(1.35, 1 + (dims.scale - 1) * 0.3) : 1;

  function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } | null {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: (screenX - rect.left - leftOffset) / dims.scale - contentOffsetX,
      y: (screenY - rect.top - topOffset) / dims.scale - contentOffsetY,
    };
  }

  // ── Drag pointer handlers at canvas level ─────────────────────────────────

  function handleCanvasPointerMove(e: React.PointerEvent) {
    if (!dragState) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    if (pt) onDragMove(pt.x, pt.y);
  }

  function handleCanvasPointerUp(e: React.PointerEvent) {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    longPressStart.current = null;
    if (!dragState) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    if (pt) {
      const target = getTableAtPoint(pt.x, pt.y, plan.tables, tableBoost);
      if (target && target.id !== dragState.sourceTable.id) {
        onDragEnd(target);
        return;
      }
    }
    onDragCancel();
  }

  // ── Hover handlers (desktop) ──────────────────────────────────────────────

  function handleTableMouseEnter(table: FloorTable, orders: Order[], e: React.MouseEvent) {
    if (dragState || window.innerWidth < 768) return;
    peekTimer.current = setTimeout(() => {
      setPeekTable({ table, orders, screenX: e.clientX, screenY: e.clientY });
    }, HOVER_DELAY_MS);
  }

  function handleTableMouseLeave() {
    if (peekTimer.current) { clearTimeout(peekTimer.current); peekTimer.current = null; }
    setPeekTable(null);
  }

  function handleTableMouseMove(e: React.MouseEvent) {
    if (peekTable) setPeekTable(prev => prev ? { ...prev, screenX: e.clientX, screenY: e.clientY } : null);
  }

  const dark = isDarkFloor(plan.floorStyle);
  const STATUS_COLORS = dark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const ZONE_COLORS_MAP = dark ? ZONE_COLORS_DARK : ZONE_COLORS_LIGHT;
  const floorBg = getFloorBackground(plan.floorStyle);

  return (
    <div
      ref={containerRef}
      style={{
        overflow: 'hidden',
        height: '100%',
        flex: 1,
        position: 'relative',
        ...floorBg,
      }}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={() => { if (dragState) onDragCancel(); }}
    >
      <div
        ref={canvasRef}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: 'absolute',
          left: leftOffset,
          top: topOffset,
          transform: `scale(${dims.scale}) translate(${contentOffsetX}px, ${contentOffsetY}px)`,
          transformOrigin: 'top left',
          userSelect: 'none',
        }}
      >
      {/* Layer 1: Zones — expanded to fill closer to walls */}
      {(plan.zones ?? []).map(zone => {
        const zc = ZONE_COLORS_MAP[zone.color];
        const outdoor = isOutdoorZone(zone.name);
        return (
          <div
            key={zone.id}
            style={{
              position: 'absolute',
              left: zone.x - ZONE_EXPAND, top: zone.y - ZONE_EXPAND,
              width: zone.width + ZONE_EXPAND * 2, height: zone.height + ZONE_EXPAND * 2,
              background: zc.bg, border: `1.5px dashed ${zc.border}`, borderRadius: 8,
              zIndex: 0, pointerEvents: 'none',
              ...(outdoor ? OUTDOOR_PATTERN_CSS : {}),
            }}
          >
            <span style={{ position: 'absolute', top: 6 + ZONE_EXPAND, left: 10 + ZONE_EXPAND, fontSize: 11, fontWeight: 600, color: zc.text, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{zone.name}</span>
          </div>
        );
      })}

      {/* Layer 2: Architectural walls */}
      <WallsSvgLayer walls={plan.walls ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} strokeScale={0.35} dark={dark} />

      {/* Layer 3: Counter with surface treatment */}
      {plan.counter && <CounterElement counter={plan.counter} />}

      {/* Layer 4: Architectural door arcs */}
      <DoorArcsSvgLayer doors={plan.doors ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} dark={dark} />

      {/* Layer 5: Labels */}
      {plan.labels.map((label) => (
        <div
          key={label.id}
          style={{ position: 'absolute', left: label.x, top: label.y, zIndex: 1 }}
        >
          <div
            style={{
              padding: '4px 12px', borderRadius: 5,
              background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: `1.5px dashed ${dark ? 'rgba(148,163,184,0.4)' : '#94a3b8'}`,
              fontSize: 13, fontWeight: 600, color: dark ? '#94a3b8' : '#475569',
              whiteSpace: 'nowrap', letterSpacing: '0.03em', textTransform: 'uppercase',
            }}
          >
            {label.text}
          </div>
        </div>
      ))}

      {/* Layer 6: Merge group backgrounds */}
      <MergeGroupBackgrounds tables={plan.tables} getTableStatus={getTableStatus} />

      {/* Layer 8: Tables */}
      {plan.tables.map((table) => {
        const info = getTableStatus(table.table_number);
        const dbId = dbTableIds.get(table.table_number) ?? table.id;
        const isDragSource = dragState?.sourceTable.id === table.id;
        const isSearchDimmed = searchMatchIds !== null && !searchMatchIds.has(table.id);
        const isDragTarget = dragState && !isDragSource;
        const isValidDropTarget = isDragTarget && table.id !== dragState.sourceTable.id;
        const isSeatValid = seatParty?.validIds.has(table.id) ?? false;
        const isSeatRecommended = seatParty?.recommendedId === table.id;
        const isSeatDimmed = seatParty && !isSeatValid;

        return (
          <StaffTableElement
            key={table.id}
            table={table}
            status={info.status}
            orders={info.orders}
            dbId={dbId}
            hasWaiterCall={info.hasWaiterCall}
            reducedMotion={reducedMotion}
            isDragSource={isDragSource}
            isValidDropTarget={!!isValidDropTarget}
            isSearchDimmed={isSearchDimmed}
            isSeatValid={isSeatValid}
            isSeatRecommended={isSeatRecommended}
            isSeatDimmed={!!isSeatDimmed}
            sizeBoost={tableBoost}
            onOccupiedClick={() => {
              if (info.hasWaiterCall) onDismissWaiterCall(table.table_number);
              onOccupiedTableClick(table, dbId, info);
            }}
            onAvailableClick={() => onAvailableTableClick(table, dbId)}
            canDrag={canDrag}
            onLongPressStart={(sx, sy) => {
              if (!canDrag || info.orders.length === 0) return;
              longPressStart.current = { x: sx, y: sy };
              longPressTimer.current = setTimeout(() => {
                onDragStart(table, dbId, info.orders);
                longPressTimer.current = null;
              }, LONG_PRESS_MS);
            }}
            onLongPressCancel={() => {
              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
              longPressStart.current = null;
            }}
            onMouseEnter={e => info.orders.length > 0 ? handleTableMouseEnter(table, info.orders, e) : undefined}
            onMouseLeave={handleTableMouseLeave}
            onMouseMove={handleTableMouseMove}
            dark={dark}
          />
        );
      })}

      {/* Drag ghost indicator */}
      {dragState && dragState.cursorX > 0 && (
        <div
          style={{
            position: 'absolute',
            left: dragState.cursorX - 20,
            top: dragState.cursorY - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(245,158,11,0.3)',
            border: '2px solid #f59e0b',
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#b45309',
          }}
        >
          {tableLabelText(dragState.sourceTable)}
        </div>
      )}
      </div>

      {/* Feature 4: Quick peek card (fixed positioning, outside canvas) */}
      {peekTable && <QuickPeekCard peek={peekTable} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE ELEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function StaffTableElement({
  table,
  status,
  orders: tableOrders,
  dbId,
  hasWaiterCall,
  reducedMotion,
  isDragSource,
  isValidDropTarget,
  isSearchDimmed,
  isSeatValid,
  isSeatRecommended,
  isSeatDimmed,
  sizeBoost,
  onOccupiedClick,
  onAvailableClick,
  canDrag,
  onLongPressStart,
  onLongPressCancel,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  dark,
}: {
  table: FloorTable;
  status: TableLiveStatus;
  orders: Order[];
  dbId: string;
  hasWaiterCall: boolean;
  reducedMotion: boolean;
  isDragSource: boolean;
  isValidDropTarget: boolean;
  isSearchDimmed: boolean;
  isSeatValid: boolean;
  isSeatRecommended: boolean;
  isSeatDimmed: boolean;
  sizeBoost: number;
  onOccupiedClick: () => void;
  onAvailableClick: () => void;
  canDrag: boolean;
  onLongPressStart: (screenX: number, screenY: number) => void;
  onLongPressCancel: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onMouseMove: (e: React.MouseEvent) => void;
  dark?: boolean;
}) {
  const { w: baseW, h: baseH } = tableSize(table.capacity);
  const w = Math.round(baseW * sizeBoost);
  const h = Math.round(baseH * sizeBoost);
  const isRound = table.shape === 'round';
  const colors = (dark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT)[status];
  const customerNames = [...new Set(
    tableOrders.map(o => o.customer_name).filter((n): n is string => !!n),
  )];
  const externalName = customerNames.length > 0 ? customerNames.map(n => shortName(n)).join(', ') : null;
  const isOccupied = tableOrders.length > 0;

  const minutes = isOccupied ? getOccupancyMinutes(tableOrders) : 0;
  const total = isOccupied ? getOrderTotal(tableOrders) : 0;
  const progress = isOccupied ? getProgressFraction(tableOrders) : 0;
  const isSmall = table.capacity <= 2;

  const progressColor = progress >= 1 ? '#22c55e' : '#f59e0b';
  const dimmed = isSearchDimmed || isSeatDimmed;

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (isDragSource) draggedRef.current = true;
  }, [isDragSource]);

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
        filter: TABLE_DROP_SHADOW,
        transition: 'box-shadow 0.15s, transform 0.15s, opacity 0.25s',
        padding: '0 4px',
        position: 'relative' as const,
        overflow: 'hidden',
        ...(isDragSource ? {
          animation: reducedMotion ? undefined : 'dragLift 0.2s forwards',
          opacity: 0.7,
        } : {}),
      }}
      className={!isDragSource ? 'hover:shadow-lg hover:scale-105' : undefined}
    >
      {hasWaiterCall && (
        <Bell
          className="absolute"
          style={{ top: 3, right: isRound ? 8 : 4, width: 12, height: 12, color: '#ef4444' }}
        />
      )}

      <span style={{ fontWeight: 700, fontSize: 13, color: colors.text, lineHeight: 1 }}>
        {tableLabelText(table)}
      </span>

      {!isOccupied ? (
        <span style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>
          {table.capacity}p
        </span>
      ) : null}

      {isOccupied && !isSmall && minutes > 0 && (
        <span style={{ fontSize: 10, fontWeight: 500, color: timerColor(minutes), marginTop: 1, lineHeight: 1 }}>
          {formatTimer(minutes)}
        </span>
      )}

      {isOccupied && total > 0 && (
        <span style={{ fontSize: 10, fontWeight: 600, color: colors.text, marginTop: 1, lineHeight: 1 }}>
          {formatPrice(total)}
        </span>
      )}
    </div>
  );

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: table.x - (w - baseW) / 2,
    top: table.y - (h - baseH) / 2,
    width: w,
    height: h,
    cursor: isDragSource ? 'grabbing' : 'pointer',
    zIndex: isDragSource ? 50 : 2,
    display: 'block',
    textDecoration: 'none',
    opacity: dimmed ? 0.35 : 1,
    transition: 'opacity 0.25s',
    overflow: 'visible',
    ...(canDrag && isOccupied ? { touchAction: 'none' as const, WebkitTouchCallout: 'none' as const } : {}),
  };

  const progressRing = isOccupied && progress > 0 ? (
    <svg
      style={{ position: 'absolute', top: -3, left: -3, width: w + 6, height: h + 6, pointerEvents: 'none', zIndex: 3 }}
    >
      {isRound ? (
        <circle
          cx={(w + 6) / 2} cy={(h + 6) / 2} r={(w + 6) / 2 - 2}
          fill="none" stroke={progressColor} strokeWidth={2.5}
          strokeDasharray={`${progress * Math.PI * (w + 2)} ${Math.PI * (w + 2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${(w + 6) / 2} ${(h + 6) / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }}
        />
      ) : (
        <rect
          x={2} y={2} width={w + 2} height={h + 2} rx={12} ry={12}
          fill="none" stroke={progressColor} strokeWidth={2.5}
          strokeDasharray={`${progress * 2 * (w + h + 4)} ${2 * (w + h + 4)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }}
        />
      )}
    </svg>
  ) : null;

  const waiterPulse = hasWaiterCall && !reducedMotion ? (
    <div style={{ position: 'absolute', inset: -4, borderRadius: isRound ? '50%' : 14, border: '2px solid rgba(239,68,68,0.6)', animation: 'waiterPulseRing 1.5s ease-out infinite', pointerEvents: 'none', zIndex: 1 }} />
  ) : hasWaiterCall && reducedMotion ? (
    <div style={{ position: 'absolute', inset: -4, borderRadius: isRound ? '50%' : 14, border: '2px solid rgba(239,68,68,0.6)', animation: 'waiterPulseRingReduced 2s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }} />
  ) : null;

  const dropTargetRing = isValidDropTarget && !reducedMotion ? (
    <div style={{ position: 'absolute', inset: -5, borderRadius: isRound ? '50%' : 15, animation: 'dropTargetGlow 1s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }} />
  ) : null;

  const seatRecommendRing = isSeatRecommended && !reducedMotion ? (
    <div style={{ position: 'absolute', inset: -5, borderRadius: isRound ? '50%' : 15, animation: 'recommendPulse 1s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}>
      <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: dark ? '#93c5fd' : '#2563eb', whiteSpace: 'nowrap', background: dark ? '#1e293b' : 'white', padding: '1px 5px', borderRadius: 4, border: `1px solid ${dark ? '#3b82f6' : '#93c5fd'}` }}>
        Best fit
      </span>
    </div>
  ) : null;

  const seatValidRing = isSeatValid && !isSeatRecommended ? (
    <div style={{ position: 'absolute', inset: -4, borderRadius: isRound ? '50%' : 14, border: '2px solid rgba(59,130,246,0.35)', pointerEvents: 'none', zIndex: 1 }} />
  ) : null;

  function handlePointerDown(e: React.PointerEvent) {
    draggedRef.current = false;
    if (canDrag && isOccupied) {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      onLongPressStart(e.clientX, e.clientY);
    }
  }

  function handlePointerMoveLocal(e: React.PointerEvent) {
    if (!canDrag || !pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD * LONG_PRESS_MOVE_THRESHOLD) {
      onLongPressCancel();
      pointerStartRef.current = null;
    }
  }

  function handleClick() {
    if (isDragSource) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (status === 'available') {
      onAvailableClick();
    } else {
      onOccupiedClick();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMoveLocal}
      onPointerUp={() => { pointerStartRef.current = null; onLongPressCancel(); }}
      onPointerCancel={() => { pointerStartRef.current = null; onLongPressCancel(); }}
      onContextMenu={canDrag && isOccupied ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      style={positionStyle}
    >
      {waiterPulse}
      {dropTargetRing}
      {seatRecommendRing}
      {seatValidRing}
      {progressRing}
      {inner}
      {externalName && (
        <span
          title={customerNames.join(', ')}
          style={{
            position: 'absolute',
            top: h + 5,
            left: w / 2,
            transform: 'translateX(-50%)',
            fontSize: 14,
            fontWeight: 700,
            color: dark ? '#d6d3d1' : '#44403c',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: w + 40,
            textAlign: 'center',
            pointerEvents: 'auto',
            lineHeight: 1.2,
          }}
        >
          {externalName}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK PEEK CARD (Feature 4)
// ═══════════════════════════════════════════════════════════════════════════════

function QuickPeekCard({ peek }: {
  peek: { table: FloorTable; orders: Order[]; screenX: number; screenY: number };
}) {
  const { table, orders, screenX, screenY } = peek;
  const minutes = getOccupancyMinutes(orders);
  const total = getOrderTotal(orders);
  const totalItems = orders.reduce(
    (sum, o) => sum + (o.items ?? []).filter(i => i.status !== 'voided').reduce((s, i) => s + i.quantity, 0), 0,
  );
  const customerName = orders.find(o => o.customer_name)?.customer_name;
  const statusSummary = getStatusSummary(orders);
  const hasWaiterCallRecent = false;

  const CARD_W = 220;
  const CARD_H = 120;
  let left = screenX + 16;
  let top = screenY - 10;
  if (left + CARD_W > window.innerWidth - 8) left = screenX - CARD_W - 16;
  if (top + CARD_H > window.innerHeight - 8) top = window.innerHeight - CARD_H - 8;
  if (top < 8) top = 8;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: CARD_W,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border p-3 space-y-1.5 text-xs">
        {customerName && (
          <p className="font-bold text-sm text-gray-900 truncate">{customerName}</p>
        )}
        <p className="text-gray-600">
          {orders.length} order{orders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">{formatPrice(total)}</span>
          <span className="text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimer(minutes)}
          </span>
        </div>
        <p className="text-gray-500">{statusSummary}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEAT PARTY BUTTON (Feature 6)
// ═══════════════════════════════════════════════════════════════════════════════

function SeatPartyButton({
  active,
  onSelectSize,
  onDismiss,
  noTablesMsg,
}: {
  active: boolean;
  onSelectSize: (size: number) => void;
  onDismiss: () => void;
  noTablesMsg: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => { if (active) { onDismiss(); } else { setOpen(!open); } }}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
          active
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        )}
      >
        <Users className="w-3.5 h-3.5" />
        {active ? 'Cancel' : 'Seat'}
      </button>

      {open && !active && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-white border rounded-xl shadow-lg p-3 w-48">
            <p className="text-xs font-medium text-gray-700 mb-2">How many guests?</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => { onSelectSize(n); setOpen(false); }}
                  className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-sm font-semibold transition-colors"
                >
                  {n}{n === 6 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {noTablesMsg && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-2 w-52">
          <p className="text-xs text-amber-800">{noTablesMsg}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERGE CONFIRM DIALOG (Feature 3)
// ═══════════════════════════════════════════════════════════════════════════════

function MergeConfirmDialog({
  source,
  onConfirm,
  onCancel,
}: {
  source: MergeDialogState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const srcLabel = tableLabelText(source.sourceTable);
  const destLabel = tableLabelText(source.destTable);
  const srcTotal = getOrderTotal(source.sourceOrders);
  const destTotal = getOrderTotal(source.destOrders);
  const srcName = source.sourceOrders.find(o => o.customer_name)?.customer_name ?? undefined;
  const destName = source.destOrders.find(o => o.customer_name)?.customer_name ?? undefined;
  const combinedTotal = srcTotal + destTotal;
  const combinedOrders = source.sourceOrders.length + source.destOrders.length;
  const allNames = [...new Set([destName, srcName].filter(Boolean) as string[])];
  const combinedNamePreview = allNames.length > 0 ? allNames.map(n => shortName(n)).join(', ') : null;

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }

  function TableCard({ label, name, total, orderCount, side }: {
    label: string; name?: string; total: number; orderCount: number; side: 'left' | 'right';
  }) {
    return (
      <div
        style={{
          animation: `${side === 'left' ? 'mergeSlideLeft' : 'mergeSlideRight'} 0.6s ease-out 0.15s forwards`,
        }}
        className="flex flex-col items-center"
      >
        <div
          className="relative flex flex-col items-center justify-center rounded-xl border-2 shadow-md"
          style={{
            width: 88,
            height: 88,
            background: 'rgba(245,158,11,0.12)',
            borderColor: '#f59e0b',
          }}
        >
          <span className="font-bold text-sm text-amber-800">{label}</span>
          <span className="text-[10px] text-amber-600 mt-1">{formatPrice(total)}</span>
          <span className="text-[9px] text-amber-500">{orderCount} order{orderCount !== 1 ? 's' : ''}</span>
        </div>
        {name && (
          <span className="text-[10px] font-medium text-stone-500 mt-1 max-w-[80px] truncate text-center">
            {shortName(name)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: 'mergeDialogIn 0.25s ease-out' }}
      >
        {/* Visual merge area */}
        <div className="relative bg-gradient-to-b from-violet-50 to-white pt-6 pb-4 px-6">
          <h3 className="font-bold text-lg text-center mb-4">Merge tables</h3>

          <div className="flex items-center justify-center gap-0">
            <TableCard label={srcLabel} name={srcName} total={srcTotal} orderCount={source.sourceOrders.length} side="left" />

            {/* Intersection zone */}
            <div className="relative flex items-center justify-center" style={{ width: 40, zIndex: 2 }}>
              <div
                className="w-8 h-8 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center"
                style={{ animation: 'mergePulse 1.5s ease-in-out infinite' }}
              >
                <ArrowRight className="w-3.5 h-3.5 text-violet-600" style={{ marginLeft: -1 }} />
              </div>
            </div>

            <TableCard label={destLabel} name={destName} total={destTotal} orderCount={source.destOrders.length} side="right" />
          </div>

          {/* Combined result preview */}
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ReceiptText className="w-3 h-3" />
              {combinedOrders} order{combinedOrders !== 1 ? 's' : ''}
            </span>
            <span className="w-px h-3 bg-gray-300" />
            <span className="font-semibold text-gray-700">{formatPrice(combinedTotal)}</span>
            {combinedNamePreview && (
              <>
                <span className="w-px h-3 bg-gray-300" />
                <span className="text-stone-500">{combinedNamePreview}</span>
              </>
            )}
          </div>
        </div>

        {/* Footer info + actions */}
        <div className="px-6 pb-5 pt-3 space-y-3">
          <p className="text-xs text-gray-500 text-center">
            All orders combine under <strong>{destLabel}</strong>. {srcLabel} becomes available.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Merge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE ORDERS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function TableOrdersModal({
  table,
  restaurant,
  onClose,
  onAddItems,
  mergeHistory,
  allTables,
  dbTableIds,
}: {
  table: SelectedTable;
  restaurant: import('@/types').Restaurant;
  onClose: () => void;
  onAddItems: (tableId: string, tableLabel: string, round: number) => void;
  mergeHistory: Map<string, { tableId: string; tableNumber: number }>;
  allTables: FloorTable[];
  dbTableIds: Map<number, string>;
}) {
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

  const mergedOrderIds = table.orders.filter(o => mergeHistory.has(o.id)).map(o => o.id);
  const canUnmerge = mergedOrderIds.length > 0;

  async function handleUnmerge() {
    const supabase = createClient();
    setUpdating('unmerge');
    try {
      const groups = new Map<string, string[]>();
      for (const oid of mergedOrderIds) {
        const orig = mergeHistory.get(oid);
        if (!orig) continue;
        const list = groups.get(orig.tableId) ?? [];
        list.push(oid);
        groups.set(orig.tableId, list);
      }

      for (const [origTableId, orderIds] of groups) {
        const { error } = await supabase
          .from('orders')
          .update({ table_id: origTableId })
          .in('id', orderIds);
        if (error) throw error;
        for (const oid of orderIds) mergeHistory.delete(oid);
      }
      toast.success('Tables unmerged');
    } catch {
      toast.error('Failed to unmerge');
    } finally {
      setUpdating(null);
    }
  }

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
              const fromMerge = mergeHistory.has(order.id);

              return (
                <div key={order.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Round {roundNum}
                    </span>
                    {names.length > 0 && (
                      <span className="text-xs text-muted-foreground">· {names.join(', ')}</span>
                    )}
                    {fromMerge && (
                      <span className="text-[10px] text-violet-500 font-medium">merged</span>
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
              onClick={() => { onClose(); onAddItems(table.dbId, table.label, table.orders.length + 1); }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Add items · Round {table.orders.length + 1}
            </button>

            {/* Feature 3: Unmerge button */}
            {canUnmerge && (
              <button
                onClick={handleUnmerge}
                disabled={!!updating}
                className="w-full py-2 rounded-xl text-xs font-medium text-violet-600 hover:bg-violet-50 border border-violet-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {updating === 'unmerge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Unmerge tables
              </button>
            )}

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

// ═══════════════════════════════════════════════════════════════════════════════
// MERGE GROUP BACKGROUNDS
// ═══════════════════════════════════════════════════════════════════════════════

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
