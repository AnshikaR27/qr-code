'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Type,
  CheckCircle2,
  Loader2,
  Save,
  Monitor,
  X,
  WifiOff,
  Bell,
  Trash2,
  Eye,
  Undo2,
  IndianRupee,
  Link2,
  Unlink,
  Merge,
  Check,
  Search,
  MousePointer2,
  PenTool,
  Store,
  DoorOpen,
  RectangleHorizontal,
  LayoutTemplate,
  Palette,
  Edit3,
  Copy,
  ListOrdered,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
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
  FloorCounter,
  FloorDoor,
  FloorLabel,
  FloorPlan,
  FloorShape,
  FloorStyle,
  FloorTable,
  FloorWall,
  FloorZone,
  Order,
  OrderNote,
  OrderStatus,
  Restaurant,
  WaiterCall,
  ZoneColor,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID     = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;
const SNAP_WALL_THRESHOLD = 18;

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function snapToWalls(
  x: number, y: number, w: number, h: number,
  walls: FloorWall[],
): { x: number; y: number } {
  let bestX = x, bestY = y;
  let bestDx = SNAP_WALL_THRESHOLD + 1;
  let bestDy = SNAP_WALL_THRESHOLD + 1;

  const edges = {
    left: x, right: x + w, top: y, bottom: y + h,
    cx: x + w / 2, cy: y + h / 2,
  };

  for (const wall of walls) {
    const pts = wall.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;

      const isVertical = Math.abs(dx) < Math.abs(dy);
      if (isVertical) {
        const wallX = (a.x + b.x) / 2;
        const segMinY = Math.min(a.y, b.y);
        const segMaxY = Math.max(a.y, b.y);
        if (edges.cy < segMinY - h / 2 || edges.cy > segMaxY + h / 2) continue;

        const dLeft = Math.abs(edges.left - wallX);
        const dRight = Math.abs(edges.right - wallX);
        if (dLeft < bestDx) { bestDx = dLeft; bestX = wallX; }
        if (dRight < bestDx) { bestDx = dRight; bestX = wallX - w; }
      } else {
        const wallY = (a.y + b.y) / 2;
        const segMinX = Math.min(a.x, b.x);
        const segMaxX = Math.max(a.x, b.x);
        if (edges.cx < segMinX - w / 2 || edges.cx > segMaxX + w / 2) continue;

        const dTop = Math.abs(edges.top - wallY);
        const dBottom = Math.abs(edges.bottom - wallY);
        if (dTop < bestDy) { bestDy = dTop; bestY = wallY; }
        if (dBottom < bestDy) { bestDy = dBottom; bestY = wallY - h; }
      }
    }
  }

  return {
    x: bestDx <= SNAP_WALL_THRESHOLD ? bestX : x,
    y: bestDy <= SNAP_WALL_THRESHOLD ? bestY : y,
  };
}

/** Prefer display_name when set, fall back to #table_number. */
function tableLabel(t: { table_number: number; display_name?: string | null }): string {
  return t.display_name?.trim() || `#${t.table_number}`;
}

/** Size by capacity. Round = border-radius 50%, square = 10px. */
function tableSize(capacity: FloorCapacity) {
  if (capacity <= 2) return { w: 70,  h: 70 };
  if (capacity <= 4) return { w: 90,  h: 90 };
  if (capacity <= 6) return { w: 130, h: 80 };
  return                    { w: 160, h: 80 };
}

/** "Bhumin Patel" → "Bhumin P." */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ─── Room builder constants ──────────────────────────────────────────────────

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

const ROOM_TEMPLATES: { name: string; label: string; desc: string; points: { x: number; y: number }[] }[] = [
  {
    name: 'rectangle', label: 'Rectangle', desc: 'Standard room',
    points: [{ x: 100, y: 100 }, { x: 1100, y: 100 }, { x: 1100, y: 700 }, { x: 100, y: 700 }],
  },
  {
    name: 'l-shape', label: 'L-Shape', desc: 'L-shaped room',
    points: [{ x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 400 }, { x: 1100, y: 400 }, { x: 1100, y: 700 }, { x: 100, y: 700 }],
  },
  {
    name: 'narrow', label: 'Narrow', desc: 'Long thin space',
    points: [{ x: 100, y: 250 }, { x: 1200, y: 250 }, { x: 1200, y: 600 }, { x: 100, y: 600 }],
  },
];

const FLOOR_STYLE_OPTIONS: { value: FloorStyle; label: string }[] = [
  { value: 'dots', label: 'Dot Grid' },
  { value: 'wood', label: 'Light Wood' },
  { value: 'tile', label: 'Tile' },
  { value: 'white', label: 'Plain White' },
  { value: 'grey', label: 'Light Grey' },
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─── Live status ──────────────────────────────────────────────────────────────

const ORDER_STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'ready',
  ready:  'delivered',
};

const ORDER_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  placed: 'Food Ready',
  ready:  'Record Payment',
};

type TableLiveStatus = 'available' | 'occupied' | 'needs_attention';

interface TableStatusInfo {
  status: TableLiveStatus;
  orders: Order[];
  waiterCall: WaiterCall | null;
}

const STATUS_COLORS: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', text: '#15803d', sub: '#16a34a' },
  occupied:        { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#b45309', sub: '#d97706' },
  needs_attention: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#b91c1c', sub: '#dc2626' },
};

const STATUS_LABELS: Record<TableLiveStatus, string> = {
  available:       'Available',
  occupied:        'Occupied',
  needs_attention: 'Needs Attention',
};

// ─── Editor types ─────────────────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved';
type EditorMode = 'select' | 'addTable' | 'addLabel' | 'drawWalls' | 'addCounter' | 'addDoor' | 'addZone';

interface LabelEditForm {
  id: string;
  text: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  restaurant: Restaurant;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FloorPlanEditor({ restaurant }: Props) {
  // ── Editor state ───────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<FloorPlan>(() => {
    const raw = restaurant.floor_plan;
    return raw ?? { tables: [], labels: [] };
  });

  const [mode, setMode]               = useState<EditorMode>('select');
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('saved');
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [isMobile, setIsMobile]       = useState(false);

  // Pending shape/capacity/name for the "Add Table" placement flow
  const [pendingShape, setPendingShape]           = useState<FloorShape>('round');
  const [pendingCapacity, setPendingCapacity]     = useState<FloorCapacity>(4);
  const [pendingDisplayName, setPendingDisplayName] = useState('');

  // Selected table for the floating edit toolbar
  const [editSelectedId, setEditSelectedId] = useState<string | null>(null);

  // Table shown in the live-status detail sheet (opened from the toolbar)
  const [sheetTableId, setSheetTableId] = useState<string | null>(null);

  // Label text editing (Dialog)
  const [labelEditForm, setLabelEditForm] = useState<LabelEditForm | null>(null);

  // Context menu (right-click)
  const [ctxMenu, setCtxMenu] = useState<{
    id: string; type: 'table' | 'label' | 'wall' | 'counter' | 'door' | 'zone'; screenX: number; screenY: number;
  } | null>(null);

  // ── Room builder state ────────────────────────────────────────────────────
  const [wallDrawingPoints, setWallDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [wallPreviewPoint, setWallPreviewPoint]   = useState<{ x: number; y: number } | null>(null);
  const [selectedWallId, setSelectedWallId]       = useState<string | null>(null);
  const [draggingWallPoint, setDraggingWallPoint] = useState<{ wallId: string; pointIndex: number } | null>(null);
  const [zoneDrawStart, setZoneDrawStart]         = useState<{ x: number; y: number } | null>(null);
  const [zoneDrawCurrent, setZoneDrawCurrent]     = useState<{ x: number; y: number } | null>(null);
  const [selectedElement, setSelectedElement]      = useState<{ type: 'counter' | 'door' | 'zone'; id: string } | null>(null);
  const [zoneEditForm, setZoneEditForm]           = useState<{ id: string; name: string; color: ZoneColor } | null>(null);
  const [showTemplates, setShowTemplates]         = useState(false);
  const [showFloorStyles, setShowFloorStyles]     = useState(false);
  const [resizing, setResizing] = useState<{
    type: 'counter' | 'zone'; id: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    origRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // ── Live status state ──────────────────────────────────────────────────────
  const [activeOrders, setActiveOrders]           = useState<Order[]>([]);
  const [activeWaiterCalls, setActiveWaiterCalls] = useState<WaiterCall[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [acknowledging, setAcknowledging]         = useState(false);
  const [markingAvailable, setMarkingAvailable]   = useState(false);
  const [paymentOrder, setPaymentOrder]           = useState<Order | null>(null);
  const [billingOrders, setBillingOrders]         = useState<Order[] | null>(null);
  const [searchQuery, setSearchQuery]             = useState('');

  // ── Zoom state ─────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef            = useRef<HTMLDivElement>(null);
  const saveTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffset           = useRef({ x: 0, y: 0 });
  const dragMoved            = useRef(false);
  const pointerDownClient    = useRef({ x: 0, y: 0 });
  const realtimeConnectedRef = useRef(false);
  /** Single-level undo snapshot taken before every mutation. */
  const previousPlan         = useRef<FloorPlan | null>(null);
  /**
   * Maps table_number → actual DB row UUID.
   * The floor plan assigns its own UUIDs when tables are drawn; if a table was
   * first created by the orders flow, the DB row has a different UUID. This ref
   * lets all DB writes (scheduleSave, mergeTables, unmergeGroup) use the correct
   * UUID so no UNIQUE-constraint 409s occur and updates actually hit the right rows.
   */
  const dbTableIds = useRef<Map<number, string>>(new Map());

  // ── Responsive check ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Zoom with Ctrl+Scroll / pinch ─────────────────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(3, Math.max(0.3, Math.round((prev + delta) * 10) / 10));
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        setCtxMenu(null);
        if (mode === 'drawWalls' && wallDrawingPoints.length > 0) {
          cancelWallDrawing();
        } else {
          setMode('select');
        }
        deselectAll();
        return;
      }

      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (editSelectedId) {
          e.preventDefault();
          removeTable(editSelectedId);
          setEditSelectedId(null);
        } else if (selectedWallId) {
          e.preventDefault();
          deleteWall(selectedWallId);
        } else if (selectedElement?.type === 'counter') {
          e.preventDefault();
          deleteCounter();
        } else if (selectedElement?.type === 'door') {
          e.preventDefault();
          deleteDoor(selectedElement.id);
        } else if (selectedElement?.type === 'zone') {
          e.preventDefault();
          deleteZone(selectedElement.id);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(z => Math.min(3, Math.round((z + 0.1) * 10) / 10));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSelectedId, selectedWallId, selectedElement, mode, wallDrawingPoints.length]);

  // ── Mode cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'drawWalls') { setWallDrawingPoints([]); setWallPreviewPoint(null); }
    if (mode !== 'addZone') { setZoneDrawStart(null); setZoneDrawCurrent(null); }
  }, [mode]);

  // ── Sync merge state from the `tables` DB table into local plan ─────────
  async function syncMergeState() {
    const supabase = createClient();
    const { data: dbTables } = await supabase
      .from('tables')
      .select('table_number, merge_group_id, merged_with')
      .eq('restaurant_id', restaurant.id);
    if (!dbTables) return;
    // Key by table_number — the floor plan's local table id may differ from
    // the DB row id when tables were first created via the orders flow.
    const mergeMap = new Map(dbTables.map(r => [r.table_number, { merge_group_id: r.merge_group_id ?? null }]));
    setPlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        const db = mergeMap.get(t.table_number);
        if (!db) return t;
        if (t.merge_group_id === db.merge_group_id) return t;
        // Recompute merged_with as floor-plan-local IDs for same group
        const mergedWithIds = db.merge_group_id
          ? prev.tables.filter(other => other.id !== t.id && mergeMap.get(other.table_number)?.merge_group_id === db.merge_group_id).map(other => other.id)
          : null;
        return { ...t, merge_group_id: db.merge_group_id, merged_with: mergedWithIds };
      }),
    }));
  }

  // ── Live data fetch ────────────────────────────────────────────────────────
  async function fetchLiveData() {
    const supabase = createClient();
    const [{ data: orders }, { data: calls }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, items:order_items(*), table:tables(id, table_number, merge_group_id)')
        .eq('restaurant_id', restaurant.id)
        .in('status', ['placed', 'ready']),
      supabase
        .from('waiter_calls')
        .select('*, table:tables(id, table_number)')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'pending'),
    ]);
    setActiveOrders(orders ?? []);
    setActiveWaiterCalls(calls ?? []);

    // Derive merge state by table_number — robust against UUID mismatches
    // between floor-plan-assigned IDs and order-created table row IDs.
    const mergeGroups = new Map<string, Set<number>>();
    for (const o of (orders ?? [])) {
      if (o.merge_group_id && o.table?.table_number) {
        const set = mergeGroups.get(o.merge_group_id) ?? new Set<number>();
        set.add(o.table.table_number);
        mergeGroups.set(o.merge_group_id, set);
      }
    }
    // Build tableNumber → groupId lookup (only groups with 2+ tables)
    const tableMerge = new Map<number, string>();
    mergeGroups.forEach((tableNumSet, groupId) => {
      if (tableNumSet.size >= 2) {
        tableNumSet.forEach(tableNum => tableMerge.set(tableNum, groupId));
      }
    });

    // Active group IDs — used to clear stale merge state
    const activeMergeGroupIds = new Set<string>();
    for (const o of (orders ?? [])) {
      if (o.merge_group_id) activeMergeGroupIds.add(o.merge_group_id);
    }

    setPlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        const groupId = tableMerge.get(t.table_number);
        if (groupId) {
          // Compute merged_with as floor-plan-local IDs for the same group
          const groupNums = mergeGroups.get(groupId)!;
          const mergedWithIds = prev.tables
            .filter(other => other.id !== t.id && groupNums.has(other.table_number))
            .map(other => other.id);
          if (t.merge_group_id === groupId) return t;
          return { ...t, merge_group_id: groupId, merged_with: mergedWithIds };
        }
        // Clear stale merge state if no active order references this group
        if (t.merge_group_id && !activeMergeGroupIds.has(t.merge_group_id)) {
          return { ...t, merge_group_id: null, merged_with: null };
        }
        return t;
      }),
    }));
  }

  // ── Populate DB table-ID map on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', restaurant.id);
      if (data) data.forEach(r => dbTableIds.current.set(r.table_number, r.id));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // ── Realtime subscription + fallback poll ──────────────────────────────────
  useEffect(() => {
    fetchLiveData();
    const supabase = createClient();

    const channel = supabase
      .channel('floor-plan-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchLiveData(),
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchLiveData(),
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchLiveData(),
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchLiveData(),
      )
      // Sync merge state when tables are merged/unmerged from the Orders tab.
      // Fetches ALL tables so every member of a merge group is updated at once.
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurant.id}` },
        () => syncMergeState(),
      )
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED';
        realtimeConnectedRef.current = connected;
        setRealtimeConnected(connected);
      });

    const pollInterval = setInterval(() => {
      if (!realtimeConnectedRef.current) fetchLiveData();
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // ── Status helpers ─────────────────────────────────────────────────────────
  function getTableStatusInfo(tableNumber: number): TableStatusInfo {
    const orders     = activeOrders.filter(o => o.table?.table_number === tableNumber);
    const waiterCall = activeWaiterCalls.find(wc => wc.table?.table_number === tableNumber) ?? null;
    let status: TableLiveStatus;
    if (waiterCall)          status = 'needs_attention';
    else if (orders.length > 0) status = 'occupied';
    else                        status = 'available';
    return { status, orders, waiterCall };
  }

  const statusCounts = plan.tables.reduce(
    (acc, t) => { acc[getTableStatusInfo(t.table_number).status]++; return acc; },
    { available: 0, occupied: 0, needs_attention: 0 } as Record<TableLiveStatus, number>,
  );

  // ── Save helpers ───────────────────────────────────────────────────────────
  function scheduleSave(next: FloorPlan) {
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      const supabase = createClient();

      // 1. Save the visual layout JSONB
      const { error } = await supabase
        .from('restaurants')
        .update({ floor_plan: next })
        .eq('id', restaurant.id);

      if (error) {
        console.error('[FloorPlan] save error:', error);
        toast.error(`Save failed: ${error.message}`);
        setSaveStatus('unsaved');
        return;
      }

      setSaveStatus('saved');

      // 2. Reconcile the `tables` DB table so orders can reference them.
      //    Use the actual DB row UUID (dbTableIds ref) instead of the floor plan
      //    UUID to avoid 409 conflicts when a table was first created by the
      //    orders flow and already has a different UUID in the DB.
      //    NEVER touch merge_group_id/merged_with — managed separately.
      if (next.tables.length > 0) {
        const rows = next.tables.map(t => ({
          id: dbTableIds.current.get(t.table_number) ?? t.id,
          restaurant_id: restaurant.id,
          table_number: t.table_number,
          display_name: t.display_name ?? null,
        }));
        await supabase.from('tables').upsert(rows, { onConflict: 'id' });
        // Keep the ref current for any tables inserted fresh this save
        rows.forEach(r => dbTableIds.current.set(r.table_number, r.id));
        // Reconcile errors are non-fatal — layout is already saved
      }
    }, 1000);
  }

  /** Mutate plan, snapshot previous state for undo, schedule save. */
  function updatePlan(updater: (prev: FloorPlan) => FloorPlan) {
    setPlan(prev => {
      previousPlan.current = prev;
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }

  // ── Undo ──────────────────────────────────────────────────────────────────
  function handleUndo() {
    const prev = previousPlan.current;
    if (!prev) return;
    previousPlan.current = null;
    setPlan(prev);
    scheduleSave(prev);
  }

  // ── Quick live-status actions (from detail sheet) ─────────────────────────
  async function markTableAvailable(tableNumbers: number[]) {
    setMarkingAvailable(true);
    try {
      const orderIds = activeOrders
        .filter(o => tableNumbers.includes(o.table?.table_number ?? -1))
        .map(o => o.id);
      if (orderIds.length === 0) { setSheetTableId(null); return; }
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .in('id', orderIds);
      if (error) { toast.error('Failed to clear table'); return; }

      // Auto-unmerge tables when clearing a merge group
      const mergeGroupId = plan.tables.find(t => tableNumbers.includes(t.table_number))?.merge_group_id;
      if (mergeGroupId) {
        updatePlan(prev => ({
          ...prev,
          tables: prev.tables.map(t =>
            t.merge_group_id === mergeGroupId
              ? { ...t, merge_group_id: null, merged_with: null }
              : t,
          ),
        }));
        toast.success('Tables cleared & unmerged');
      } else {
        toast.success('Table marked as available');
      }
      setSheetTableId(null);
      fetchLiveData();
    } finally {
      setMarkingAvailable(false);
    }
  }

  async function acknowledgeWaiterCall(callId: string) {
    setAcknowledging(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('waiter_calls')
        .update({ status: 'acknowledged' })
        .eq('id', callId);
      if (error) { toast.error('Failed to acknowledge call'); return; }
      toast.success('Waiter call acknowledged');
      fetchLiveData();
    } finally {
      setAcknowledging(false);
    }
  }

  async function advanceOrderStatus(orderId: string, currentStatus: OrderStatus) {
    if (currentStatus === 'ready') {
      const order = activeOrders.find((o) => o.id === orderId);
      if (order) { setPaymentOrder(order); return; }
    }
    const nextStatus = ORDER_STATUS_FLOW[currentStatus];
    if (!nextStatus) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);
    if (error) { toast.error('Failed to update order'); return; }
    fetchLiveData();
  }

  async function handleBillingConfirm(orderIds: string[], data: BillingConfirmData) {
    setPaymentOrder(null);
    setBillingOrders(null);
    const supabase = createClient();
    for (const id of orderIds) {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivered' as OrderStatus,
          payment_method: data.payment_method,
          payment_methods: data.payment_methods,
          discount_amount: data.discount_amount,
          discount_type: data.discount_type,
          discount_before_tax: data.discount_before_tax,
        })
        .eq('id', id);
      if (error) { toast.error('Failed to record payment'); return; }
    }
    // Determine which merge groups were touched by this payment.
    // Read merge_group_id from plan.tables (always current in memory) rather
    // than activeOrders.table.merge_group_id, which is stale until the next
    // fetchLiveData fires — it won't have merge_group_id if fetchLiveData
    // ran before the 1-second scheduleSave wrote the merge to the tables table.
    const billedTableNumbers = activeOrders
      .filter(o => orderIds.includes(o.id))
      .map(o => o.table?.table_number ?? -1)
      .filter(n => n !== -1);

    const mergeGroupsToCheck = new Set(
      plan.tables
        .filter(t => billedTableNumbers.includes(t.table_number) && t.merge_group_id)
        .map(t => t.merge_group_id!),
    );

    // Only dissolve a merge group when NO other active orders remain at any
    // table in that group after this payment. This prevents premature dissolution
    // when only one table in a merged pair pays while the other is still open.
    const groupsToDissolve: string[] = [];
    for (const mergeGroupId of Array.from(mergeGroupsToCheck)) {
      const groupTableNumbers = plan.tables
        .filter(t => t.merge_group_id === mergeGroupId)
        .map(t => t.table_number);
      const remainingOrders = activeOrders.filter(
        o => !orderIds.includes(o.id) && groupTableNumbers.includes(o.table?.table_number ?? -1),
      );
      if (remainingOrders.length === 0) groupsToDissolve.push(mergeGroupId);
    }

    if (groupsToDissolve.length > 0) {
      updatePlan(prev => ({
        ...prev,
        tables: prev.tables.map(t =>
          t.merge_group_id && groupsToDissolve.includes(t.merge_group_id)
            ? { ...t, merge_group_id: null, merged_with: null }
            : t,
        ),
      }));
      toast.success('Payment recorded · tables unmerged');
    } else {
      toast.success(`Payment recorded — ${data.payment_method.toUpperCase()}`);
    }
    fetchLiveData();
  }

  // ── Canvas click ──────────────────────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== canvasRef.current) return;

    deselectAll();

    const rect = canvasRef.current!.getBoundingClientRect();
    const x    = snap(Math.max(0, (e.clientX - rect.left) / zoom));
    const y    = snap(Math.max(0, (e.clientY - rect.top) / zoom));

    if (mode === 'addTable') {
      placeTable(x, y);
    } else if (mode === 'addLabel') {
      placeLabel(x, y);
      setMode('select');
    } else if (mode === 'drawWalls') {
      addWallPoint(x, y);
    } else if (mode === 'addDoor') {
      placeDoor(x, y);
      setMode('select');
    } else if (mode === 'addCounter') {
      placeCounter(x, y);
    } else if (mode === 'select') {
      const raw = (e.clientX - rect.left) / zoom;
      const rawY = (e.clientY - rect.top) / zoom;
      const wallId = findWallAt(raw, rawY);
      if (wallId) setSelectedWallId(wallId);
    }
  }

  function handleCanvasDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode === 'drawWalls' && wallDrawingPoints.length >= 3) {
      e.preventDefault();
      closeWallShape();
      setMode('select');
    }
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== canvasRef.current) return;
    if (mode === 'addZone') {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = snap((e.clientX - rect.left) / zoom);
      const y = snap((e.clientY - rect.top) / zoom);
      setZoneDrawStart({ x, y });
      setZoneDrawCurrent({ x, y });
    }
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (mode === 'drawWalls' && wallDrawingPoints.length > 0 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setWallPreviewPoint({ x: snap((e.clientX - rect.left) / zoom), y: snap((e.clientY - rect.top) / zoom) });
    }
    if (mode === 'addZone' && zoneDrawStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setZoneDrawCurrent({ x: snap((e.clientX - rect.left) / zoom), y: snap((e.clientY - rect.top) / zoom) });
    }
  }

  function handleCanvasPointerUp() {
    if (mode === 'addZone' && zoneDrawStart && zoneDrawCurrent) {
      createZone(zoneDrawStart.x, zoneDrawStart.y, zoneDrawCurrent.x - zoneDrawStart.x, zoneDrawCurrent.y - zoneDrawStart.y);
      setZoneDrawStart(null);
      setZoneDrawCurrent(null);
      setMode('select');
    }
  }

  function placeTable(x: number, y: number) {
    const existingNumbers = plan.tables.map(t => t.table_number);
    const nextNum = existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
    const name = pendingDisplayName.trim() || null;

    // Duplicate display_name check
    if (name && plan.tables.some(t => t.display_name?.trim() === name)) {
      toast.error(`Name "${name}" is already used on the canvas`);
      return;
    }

    const ft: FloorTable = {
      id: crypto.randomUUID(),
      table_number: nextNum,
      display_name: name,
      x, y,
      shape: pendingShape,
      capacity: pendingCapacity,
    };

    updatePlan(prev => ({ ...prev, tables: [...prev.tables, ft] }));
    setEditSelectedId(ft.id);
    setPendingDisplayName('');
    setMode('select');
  }

  function placeLabel(x: number, y: number) {
    const fl: FloorLabel = { id: crypto.randomUUID(), text: 'Section', x, y };
    updatePlan(prev => ({ ...prev, labels: [...prev.labels, fl] }));
  }

  // ── Inline table edits (from floating toolbar) ────────────────────────────
  function changeCapacity(tableId: string, capacity: FloorCapacity) {
    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.id === tableId ? { ...t, capacity } : t),
    }));
  }

  function changeShape(tableId: string, shape: FloorShape) {
    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.id === tableId ? { ...t, shape } : t),
    }));
  }

  function commitDisplayName(tableId: string, newName: string) {
    const trimmed = newName.trim();
    if (trimmed && plan.tables.some(t => t.id !== tableId && t.display_name?.trim() === trimmed)) {
      toast.error(`Name "${trimmed}" is already used on the canvas`);
      return;
    }
    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.id === tableId ? { ...t, display_name: trimmed || null } : t),
    }));
  }

  function removeTable(tableId: string) {
    updatePlan(prev => {
      const deleted = prev.tables.find(t => t.id === tableId);
      let tables = prev.tables.filter(t => t.id !== tableId);

      // Clean up merge group when a member is deleted
      if (deleted?.merge_group_id) {
        const groupId = deleted.merge_group_id;
        const remaining = tables.filter(t => t.merge_group_id === groupId);
        if (remaining.length <= 1) {
          // Only 0 or 1 left — dissolve the group
          tables = tables.map(t =>
            t.merge_group_id === groupId ? { ...t, merge_group_id: null, merged_with: null } : t,
          );
        } else {
          // 2+ remain — just remove deleted ID from their merged_with
          tables = tables.map(t =>
            t.merge_group_id === groupId
              ? { ...t, merged_with: (t.merged_with ?? []).filter(mid => mid !== tableId) }
              : t,
          );
        }
      }

      return { ...prev, tables };
    });
  }

  function removeLabel(labelId: string) {
    updatePlan(prev => ({ ...prev, labels: prev.labels.filter(l => l.id !== labelId) }));
  }

  function duplicateTable(tableId: string) {
    const src = plan.tables.find(t => t.id === tableId);
    if (!src) return;
    const existingNumbers = plan.tables.map(t => t.table_number);
    const nextNum = existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
    const { w } = tableSize(src.capacity);
    const ft: FloorTable = {
      id: crypto.randomUUID(),
      table_number: nextNum,
      display_name: null,
      x: Math.min(CANVAS_W - w, src.x + w + GRID),
      y: src.y,
      shape: src.shape,
      capacity: src.capacity,
    };
    updatePlan(prev => ({ ...prev, tables: [...prev.tables, ft] }));
    setEditSelectedId(ft.id);
    toast.success(`Table #${nextNum} created`);
  }

  // ── Auto-number ────────────────────────────────────────────────────────
  const [showAutoNumberConfirm, setShowAutoNumberConfirm] = useState(false);

  function autoNumberTables() {
    const sorted = [...plan.tables].sort((a, b) => {
      const rowA = Math.floor(a.y / 80);
      const rowB = Math.floor(b.y / 80);
      if (rowA !== rowB) return rowA - rowB;
      return a.x - b.x;
    });
    const idToNewNumber = new Map(sorted.map((t, i) => [t.id, i + 1]));
    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => ({
        ...t,
        table_number: idToNewNumber.get(t.id) ?? t.table_number,
      })),
    }));
    setShowAutoNumberConfirm(false);
    toast.success(`Renumbered ${sorted.length} tables by position`);
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  function handlePointerDown(
    e: React.PointerEvent,
    id: string,
    elemX: number,
    elemY: number,
  ) {
    if (mode !== 'select') return;
    e.preventDefault();
    e.stopPropagation();

    dragMoved.current = false;
    pointerDownClient.current = { x: e.clientX, y: e.clientY };

    const rect = canvasRef.current!.getBoundingClientRect();
    dragOffset.current = {
      x: (e.clientX - rect.left) / zoom - elemX,
      y: (e.clientY - rect.top) / zoom  - elemY,
    };
    setDraggingId(id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(
    e: React.PointerEvent,
    id: string,
    elemW: number,
    elemH: number,
  ) {
    if (draggingId !== id) return;

    const dx = Math.abs(e.clientX - pointerDownClient.current.x);
    const dy = Math.abs(e.clientY - pointerDownClient.current.y);
    if (dx > 5 || dy > 5) dragMoved.current = true;

    const rect = canvasRef.current!.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom - dragOffset.current.x;
    const rawY = (e.clientY - rect.top) / zoom  - dragOffset.current.y;
    let x    = snap(Math.max(0, Math.min(CANVAS_W - elemW, rawX)));
    let y    = snap(Math.max(0, Math.min(CANVAS_H - elemH, rawY)));

    const isTable = plan.tables.some(t => t.id === id);
    if (isTable && plan.walls?.length) {
      const snapped = snapToWalls(x, y, elemW, elemH, plan.walls);
      x = snapped.x;
      y = snapped.y;
    }

    setPlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => t.id === id ? { ...t, x, y } : t),
      labels: prev.labels.map(l => l.id === id ? { ...l, x, y } : l),
      doors: (prev.doors ?? []).map(d => d.id === id ? { ...d, x, y } : d),
      zones: (prev.zones ?? []).map(z => z.id === id ? { ...z, x, y } : z),
      counter: prev.counter && id === 'counter' ? { ...prev.counter, x, y } : prev.counter,
    }));
  }

  function handlePointerUp(e: React.PointerEvent, id: string, onTap?: () => void) {
    if (draggingId !== id) return;
    setDraggingId(null);
    if (!dragMoved.current) {
      onTap?.();
    } else {
      setPlan(prev => {
        previousPlan.current = prev;
        scheduleSave(prev);
        return prev;
      });
    }
  }

  /** Merge selected tables into a group (called from TableDetailSheet) */
  async function mergeTables(tableIds: string[]) {
    if (tableIds.length < 2) return;
    const groupId = crypto.randomUUID();
    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (tableIds.includes(t.id)) {
          return {
            ...t,
            merge_group_id: groupId,
            merged_with: tableIds.filter(id => id !== t.id),
          };
        }
        return t;
      }),
    }));

    // Resolve actual DB row UUIDs (floor plan UUIDs may differ from DB UUIDs
    // when tables were first created via the orders flow).
    const dbIds = plan.tables
      .filter(t => tableIds.includes(t.id))
      .map(t => dbTableIds.current.get(t.table_number) ?? t.id);

    // Sync merge_group_id to active orders at these tables so the
    // KitchenDashboard picks it up via its realtime subscription on orders.
    // Also sync to the tables DB.
    const supabase = createClient();
    await supabase
      .from('orders')
      .update({ merge_group_id: groupId })
      .eq('restaurant_id', restaurant.id)
      .in('table_id', dbIds)
      .is('payment_method', null)
      .or('status.eq.placed,status.eq.ready');
    await supabase
      .from('tables')
      .update({ merge_group_id: groupId, merged_with: dbIds })
      .in('id', dbIds);

    fetchLiveData();

    const labels = plan.tables
      .filter(t => tableIds.includes(t.id))
      .map(t => tableLabel(t))
      .join(' + ');
    toast.success(`Tables ${labels} merged`);
  }

  /** Unmerge all tables in a merge group */
  async function unmergeGroup(mergeGroupId: string) {
    // Collect actual DB row UUIDs (floor plan IDs may differ)
    const dbIds = plan.tables
      .filter(t => t.merge_group_id === mergeGroupId)
      .map(t => dbTableIds.current.get(t.table_number) ?? t.id);
    // Keep floor plan IDs for the local state update below
    const tableIds = plan.tables
      .filter(t => t.merge_group_id === mergeGroupId)
      .map(t => t.id);

    updatePlan(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.merge_group_id === mergeGroupId
          ? { ...t, merge_group_id: null, merged_with: null }
          : t,
      ),
    }));

    // Clear merge_group_id on active orders at these tables so the
    // KitchenDashboard picks up the unmerge via realtime on orders.
    if (dbIds.length > 0) {
      const supabase = createClient();
      await supabase
        .from('orders')
        .update({ merge_group_id: null })
        .eq('restaurant_id', restaurant.id)
        .in('table_id', dbIds)
        .or('status.eq.placed,status.eq.ready');
      await supabase
        .from('tables')
        .update({ merge_group_id: null, merged_with: null })
        .in('id', dbIds);
    }

    fetchLiveData();
    toast.success('Tables unmerged');
  }

  // ── Context menu ─────────────────────────────────────────────────────────
  function handleContextMenu(
    e: React.MouseEvent,
    id: string,
    type: 'table' | 'label' | 'wall' | 'counter' | 'door' | 'zone',
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, type, screenX: e.clientX, screenY: e.clientY });
  }

  // ── Room builder handlers ─────────────────────────────────────────────────

  // Wall drawing
  function addWallPoint(x: number, y: number) {
    setWallDrawingPoints(prev => [...prev, { x, y }]);
  }

  function closeWallShape() {
    if (wallDrawingPoints.length < 3) {
      toast.error('A wall needs at least 3 corner points');
      return;
    }
    const wall: FloorWall = { id: crypto.randomUUID(), points: [...wallDrawingPoints] };
    updatePlan(prev => ({ ...prev, walls: [...(prev.walls ?? []), wall] }));
    setWallDrawingPoints([]);
    setWallPreviewPoint(null);
  }

  function cancelWallDrawing() {
    setWallDrawingPoints([]);
    setWallPreviewPoint(null);
  }

  function deleteWall(wallId: string) {
    updatePlan(prev => ({ ...prev, walls: (prev.walls ?? []).filter(w => w.id !== wallId) }));
    if (selectedWallId === wallId) setSelectedWallId(null);
  }

  function moveWallPoint(wallId: string, pointIndex: number, x: number, y: number) {
    setPlan(prev => ({
      ...prev,
      walls: (prev.walls ?? []).map(w =>
        w.id === wallId
          ? { ...w, points: w.points.map((p, i) => i === pointIndex ? { x, y } : p) }
          : w,
      ),
    }));
  }

  function startWallPointDrag(e: React.PointerEvent, wallId: string, pointIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingWallPoint({ wallId, pointIndex });
  }

  function handleWallPointMove(e: React.PointerEvent) {
    if (!draggingWallPoint) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = snap(Math.max(0, Math.min(CANVAS_W, (e.clientX - rect.left) / zoom)));
    const y = snap(Math.max(0, Math.min(CANVAS_H, (e.clientY - rect.top) / zoom)));
    moveWallPoint(draggingWallPoint.wallId, draggingWallPoint.pointIndex, x, y);
  }

  function handleWallPointUp() {
    if (!draggingWallPoint) return;
    setPlan(prev => { previousPlan.current = prev; scheduleSave(prev); return prev; });
    setDraggingWallPoint(null);
  }

  function findWallAt(x: number, y: number): string | null {
    for (const wall of (plan.walls ?? [])) {
      const pts = wall.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) < 12) return wall.id;
      }
    }
    return null;
  }

  // Counter
  function placeCounter(x: number, y: number) {
    if (plan.counter) {
      toast.error('Only one counter is allowed. Delete the existing one first.');
      setMode('select');
      return;
    }
    const counter: FloorCounter = { x, y, width: 200, height: 80, rotation: 0 };
    updatePlan(prev => ({ ...prev, counter }));
    setMode('select');
  }

  function deleteCounter() {
    updatePlan(prev => ({ ...prev, counter: null }));
    setSelectedElement(null);
  }

  // Doors
  function placeDoor(x: number, y: number) {
    const door: FloorDoor = { id: crypto.randomUUID(), x, y, rotation: 0 };
    updatePlan(prev => ({ ...prev, doors: [...(prev.doors ?? []), door] }));
  }

  function deleteDoor(doorId: string) {
    updatePlan(prev => ({ ...prev, doors: (prev.doors ?? []).filter(d => d.id !== doorId) }));
    setSelectedElement(null);
  }

  // Zones
  function createZone(x: number, y: number, w: number, h: number) {
    const zone: FloorZone = {
      id: crypto.randomUUID(), name: 'Section',
      x: Math.min(x, x + w), y: Math.min(y, y + h),
      width: Math.abs(w), height: Math.abs(h), color: 'blue',
    };
    if (zone.width < 40 || zone.height < 40) return;
    updatePlan(prev => ({ ...prev, zones: [...(prev.zones ?? []), zone] }));
    setZoneEditForm({ id: zone.id, name: zone.name, color: zone.color });
  }

  function deleteZone(zoneId: string) {
    updatePlan(prev => ({ ...prev, zones: (prev.zones ?? []).filter(z => z.id !== zoneId) }));
    setSelectedElement(null);
  }

  function commitZoneEdit() {
    if (!zoneEditForm) return;
    updatePlan(prev => ({
      ...prev,
      zones: (prev.zones ?? []).map(z =>
        z.id === zoneEditForm.id ? { ...z, name: zoneEditForm.name, color: zoneEditForm.color } : z,
      ),
    }));
    setZoneEditForm(null);
  }

  // Room templates
  function applyTemplate(template: typeof ROOM_TEMPLATES[number]) {
    const wall: FloorWall = { id: crypto.randomUUID(), points: [...template.points] };
    updatePlan(prev => ({ ...prev, walls: [...(prev.walls ?? []), wall] }));
    setShowTemplates(false);
    toast.success(`${template.label} template added`);
  }

  // Floor style
  function changeFloorStyle(style: FloorStyle) {
    updatePlan(prev => ({ ...prev, floorStyle: style }));
    setShowFloorStyles(false);
  }

  // Resize handlers for counter/zones
  function startResize(
    e: React.PointerEvent,
    type: 'counter' | 'zone',
    id: string,
    handle: 'nw' | 'ne' | 'sw' | 'se',
    rect: { x: number; y: number; width: number; height: number },
  ) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setResizing({ type, id, handle, origRect: { ...rect } });
  }

  function handleResizeMove(e: React.PointerEvent) {
    if (!resizing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = snap((e.clientX - rect.left) / zoom);
    const my = snap((e.clientY - rect.top) / zoom);
    const o = resizing.origRect;
    let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
    if (resizing.handle.includes('w')) { nx = Math.min(mx, o.x + o.width - 40); nw = o.x + o.width - nx; }
    if (resizing.handle.includes('e')) { nw = Math.max(40, mx - o.x); }
    if (resizing.handle.includes('n')) { ny = Math.min(my, o.y + o.height - 40); nh = o.y + o.height - ny; }
    if (resizing.handle.includes('s')) { nh = Math.max(40, my - o.y); }

    if (resizing.type === 'counter') {
      setPlan(prev => ({ ...prev, counter: prev.counter ? { ...prev.counter, x: nx, y: ny, width: nw, height: nh } : null }));
    } else {
      setPlan(prev => ({ ...prev, zones: (prev.zones ?? []).map(z => z.id === resizing.id ? { ...z, x: nx, y: ny, width: nw, height: nh } : z) }));
    }
  }

  function handleResizeUp() {
    if (!resizing) return;
    setPlan(prev => { previousPlan.current = prev; scheduleSave(prev); return prev; });
    setResizing(null);
  }

  // Deselect all room builder elements
  function deselectAll() {
    setEditSelectedId(null);
    setSelectedWallId(null);
    setSelectedElement(null);
  }

  // ── Label edit dialog ─────────────────────────────────────────────────────
  function commitLabelEdit() {
    if (!labelEditForm) return;
    updatePlan(prev => ({
      ...prev,
      labels: prev.labels.map(l =>
        l.id === labelEditForm.id ? { ...l, text: labelEditForm.text } : l,
      ),
    }));
    setLabelEditForm(null);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const editSelectedTable = editSelectedId
    ? plan.tables.find(t => t.id === editSelectedId) ?? null
    : null;

  const sheetTable      = sheetTableId ? plan.tables.find(t => t.id === sheetTableId) ?? null : null;
  const sheetMergeGroup = sheetTable?.merge_group_id
    ? plan.tables.filter(t => t.merge_group_id === sheetTable.merge_group_id)
    : sheetTable ? [sheetTable] : [];
  const sheetStatusInfo = sheetTable ? (() => {
    // Combine status info from all tables in merge group
    const tableNumbers = sheetMergeGroup.map(t => t.table_number);
    const orders = activeOrders.filter(o => tableNumbers.includes(o.table?.table_number ?? -1));
    const waiterCall = activeWaiterCalls.find(wc => tableNumbers.includes(wc.table?.table_number ?? -1)) ?? null;
    let status: TableLiveStatus;
    if (waiterCall) status = 'needs_attention';
    else if (orders.length > 0) status = 'occupied';
    else status = 'available';
    return { status, orders, waiterCall } as TableStatusInfo;
  })() : null;

  const tableStatusMap = new Map(plan.tables.map(t => [t.table_number, getTableStatusInfo(t.table_number)]));

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Floor Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{restaurant.name}</p>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <Monitor className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">Open on a desktop browser to edit the floor plan.</p>
        </div>
        <div className="overflow-auto rounded-xl border shadow-sm">
          <ViewCanvas
            plan={plan}
            tableStatusMap={tableStatusMap}
            onTableClick={t => setSheetTableId(t.id)}
          />
        </div>
        <TableDetailSheet
          table={sheetTable}
          mergeGroup={sheetMergeGroup}
          allTables={plan.tables}
          tableStatusMap={tableStatusMap}
          statusInfo={sheetStatusInfo}
          onClose={() => setSheetTableId(null)}
          onMarkAvailable={markTableAvailable}
          onAcknowledge={acknowledgeWaiterCall}
          acknowledging={acknowledging}
          markingAvailable={markingAvailable}
          onRefresh={fetchLiveData}
          onAdvanceStatus={advanceOrderStatus}
          onGenerateBill={(tableOrders) => { setSheetTableId(null); setBillingOrders(tableOrders); }}
          onMergeTables={mergeTables}
          onUnmergeGroup={unmergeGroup}
        />
      </div>
    );
  }

  // ── Desktop editor ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-white flex-shrink-0">
        <h1 className="text-base font-semibold mr-1">Floor Plan</h1>

        {mode !== 'select' && (
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-2"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}

        {mode === 'drawWalls' && wallDrawingPoints.length >= 3 && (
          <Button size="sm" variant="outline" onClick={() => { closeWallShape(); setMode('select'); }} className="ml-2">
            Close Shape ({wallDrawingPoints.length} pts)
          </Button>
        )}

        <Button size="sm" variant="ghost" onClick={handleUndo} disabled={!previousPlan.current} className="ml-1" title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </Button>

        {plan.tables.length >= 2 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAutoNumberConfirm(true)}
            className="ml-1 text-xs gap-1.5"
            title="Renumber tables by position"
          >
            <ListOrdered className="w-4 h-4" />
            Auto-number
          </Button>
        )}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            {realtimeConnected ? (
              <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="font-medium text-green-700">Live</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-600">Reconnecting…</span></>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveStatus === 'saving'  && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>}
            {saveStatus === 'saved'   && <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Saved</>}
            {saveStatus === 'unsaved' && <><Save className="w-3.5 h-3.5" /> Unsaved changes</>}
          </div>
        </div>
      </div>

      {/* ── Status summary bar ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2 border-b bg-gray-50 flex-shrink-0 text-xs">
        <span className="text-muted-foreground font-medium">
          {plan.tables.length} table{plan.tables.length !== 1 ? 's' : ''}:
        </span>
        {([
          { key: 'available', color: 'bg-green-500', textColor: 'text-green-700', label: 'available' },
          { key: 'occupied',  color: 'bg-amber-500', textColor: 'text-amber-700', label: 'occupied' },
          { key: 'needs_attention', color: 'bg-red-500', textColor: 'text-red-700', label: 'needs attention' },
        ] as const).map(({ key, color, textColor, label }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', color)} />
            <span className={cn('font-medium', textColor)}>{statusCounts[key]}</span>
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
        {/* Search by customer name */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customer…"
            className="pl-7 pr-6 py-1 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-44"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Mode info bars ── */}
      {mode === 'addTable' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 bg-blue-50 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Name:</span>
            <input type="text" value={pendingDisplayName} onChange={e => setPendingDisplayName(e.target.value)} placeholder="e.g. L1, VIP, P3" maxLength={12} className="w-28 text-xs border border-blue-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-blue-400" />
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Shape:</span>
            {(['round', 'square'] as FloorShape[]).map(s => (
              <button key={s} type="button" onClick={() => setPendingShape(s)} className={cn('px-2.5 py-1 text-xs rounded-md border transition-colors', pendingShape === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50')}>
                {s === 'round' ? '⭕ Round' : '⬛ Square'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Seats:</span>
            {([2, 4, 6, 8] as FloorCapacity[]).map(c => (
              <button key={c} type="button" onClick={() => setPendingCapacity(c)} className={cn('w-8 h-7 text-xs rounded-md border transition-colors', pendingCapacity === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50')}>{c}</button>
            ))}
          </div>
          <span className="text-xs text-blue-600 ml-auto">Click on the canvas to place</span>
        </div>
      )}
      {mode === 'addLabel' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">Click anywhere on the floor to place a section label</div>
      )}
      {mode === 'drawWalls' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">Click to place corner points. Double-click to close the shape. {wallDrawingPoints.length > 0 && `(${wallDrawingPoints.length} point${wallDrawingPoints.length !== 1 ? 's' : ''} placed)`}</div>
      )}
      {mode === 'addCounter' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">Click on the canvas to place the counter block</div>
      )}
      {mode === 'addDoor' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">Click on the canvas to place a door/entrance marker</div>
      )}
      {mode === 'addZone' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">Click and drag on the canvas to draw a zone rectangle</div>
      )}

      {/* ── Main area: sidebar + canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Tool palette sidebar ── */}
        <div className="w-14 border-r bg-white flex-shrink-0 flex flex-col items-center py-3 gap-1 relative">
          {([
            { m: 'select' as EditorMode, icon: MousePointer2, label: 'Select / Move' },
            { m: 'drawWalls' as EditorMode, icon: PenTool, label: 'Draw Walls' },
            { m: 'addCounter' as EditorMode, icon: Store, label: 'Add Counter' },
            { m: 'addDoor' as EditorMode, icon: DoorOpen, label: 'Add Door' },
            { m: 'addZone' as EditorMode, icon: RectangleHorizontal, label: 'Add Zone' },
            { m: 'addTable' as EditorMode, icon: Plus, label: 'Add Table' },
            { m: 'addLabel' as EditorMode, icon: Type, label: 'Add Label' },
          ] as const).map(tool => (
            <button
              key={tool.m}
              onClick={() => {
                if (mode === 'drawWalls' && tool.m !== 'drawWalls') cancelWallDrawing();
                if (tool.m === 'addTable') setPendingDisplayName('');
                deselectAll();
                setMode(m => m === tool.m ? 'select' : tool.m);
              }}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                mode === tool.m ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
              title={tool.label}
            >
              <tool.icon className="w-5 h-5" />
            </button>
          ))}

          <div className="h-px w-8 bg-gray-200 my-1" />

          {/* Room Templates */}
          <button
            onClick={() => { setShowTemplates(v => !v); setShowFloorStyles(false); }}
            className={cn('w-10 h-10 rounded-lg flex items-center justify-center transition-colors', showTemplates ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')}
            title="Room Templates"
          >
            <LayoutTemplate className="w-5 h-5" />
          </button>

          {/* Floor Style */}
          <button
            onClick={() => { setShowFloorStyles(v => !v); setShowTemplates(false); }}
            className={cn('w-10 h-10 rounded-lg flex items-center justify-center transition-colors', showFloorStyles ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')}
            title="Floor Texture"
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Templates popup */}
          {showTemplates && (
            <div className="absolute left-[60px] top-[280px] z-50 w-52 bg-white border rounded-xl shadow-xl p-3" onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Room Templates</p>
              {ROOM_TEMPLATES.map(t => (
                <button key={t.name} onClick={() => applyTemplate(t)} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Floor styles popup */}
          {showFloorStyles && (
            <div className="absolute left-[60px] top-[320px] z-50 w-48 bg-white border rounded-xl shadow-xl p-3" onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Floor Texture</p>
              {FLOOR_STYLE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => changeFloorStyle(s.value)}
                  className={cn('w-full text-left px-3 py-2 text-sm rounded-lg transition-colors', (plan.floorStyle ?? 'dots') === s.value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Canvas scroll area ── */}
        <div ref={scrollContainerRef} className={cn(
          "overflow-auto bg-gray-100 relative",
          zoom > 1 ? "fixed inset-0 z-[200] p-2" : "flex-1 p-4"
        )}>
          {/* Zoom controls */}
          <div className="sticky top-2 left-2 z-[100] inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm border rounded-lg px-1.5 py-1 shadow-sm mb-2">
            <button onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))} className="p-1 rounded hover:bg-gray-100 text-gray-600" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs font-medium text-gray-600 w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.1) * 10) / 10))} className="p-1 rounded hover:bg-gray-100 text-gray-600" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            {zoom > 1 ? (
              <button onClick={() => setZoom(1)} className="p-1 rounded hover:bg-gray-100 text-gray-600" title="Exit fullscreen"><Minimize2 className="w-3.5 h-3.5" /></button>
            ) : (
              <button onClick={() => setZoom(1)} className="p-1 rounded hover:bg-gray-100 text-gray-600" title="Reset zoom"><Maximize2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}>
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              position: 'relative',
              ...getFloorBackground(plan.floorStyle),
              cursor: mode !== 'select' ? 'crosshair' : 'default',
              userSelect: 'none',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="rounded-xl border bg-white shadow-sm"
          >
            {/* Layer 1: Zones */}
            {(plan.zones ?? []).map(zone => {
              const zc = ZONE_COLORS_MAP[zone.color];
              const isSel = selectedElement?.type === 'zone' && selectedElement.id === zone.id;
              const outdoor = isOutdoorZone(zone.name);
              return (
                <div
                  key={zone.id}
                  style={{
                    position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height,
                    background: zc.bg, border: `1.5px ${isSel ? 'solid' : 'dashed'} ${zc.border}`, borderRadius: 8,
                    zIndex: 0, cursor: mode === 'select' ? (draggingId === zone.id ? 'grabbing' : 'grab') : 'default',
                    touchAction: 'none',
                    ...(outdoor ? OUTDOOR_PATTERN_CSS : {}),
                  }}
                  onPointerDown={e => handlePointerDown(e, zone.id, zone.x, zone.y)}
                  onPointerMove={e => handlePointerMove(e, zone.id, zone.width, zone.height)}
                  onPointerUp={e => handlePointerUp(e, zone.id, () => { deselectAll(); setSelectedElement({ type: 'zone', id: zone.id }); })}
                  onContextMenu={e => handleContextMenu(e, zone.id, 'zone')}
                >
                  <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontWeight: 600, color: zc.text, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{zone.name}</span>
                  {isSel && (['nw','ne','sw','se'] as const).map(h => (
                    <div
                      key={h}
                      style={{
                        position: 'absolute', width: 10, height: 10, background: 'white', border: '2px solid #2563eb', borderRadius: 2, cursor: `${h}-resize`, zIndex: 60,
                        ...(h.includes('n') ? { top: -5 } : { bottom: -5 }),
                        ...(h.includes('w') ? { left: -5 } : { right: -5 }),
                      }}
                      onPointerDown={e => startResize(e, 'zone', zone.id, h, { x: zone.x, y: zone.y, width: zone.width, height: zone.height })}
                      onPointerMove={handleResizeMove}
                      onPointerUp={handleResizeUp}
                    />
                  ))}
                </div>
              );
            })}

            {/* Zone draw preview */}
            {mode === 'addZone' && zoneDrawStart && zoneDrawCurrent && (
              <div style={{
                position: 'absolute',
                left: Math.min(zoneDrawStart.x, zoneDrawCurrent.x),
                top: Math.min(zoneDrawStart.y, zoneDrawCurrent.y),
                width: Math.abs(zoneDrawCurrent.x - zoneDrawStart.x),
                height: Math.abs(zoneDrawCurrent.y - zoneDrawStart.y),
                background: 'rgba(59,130,246,0.08)', border: '2px dashed rgba(59,130,246,0.4)', borderRadius: 8,
                zIndex: 0, pointerEvents: 'none',
              }} />
            )}

            {/* Layer 2: Walls (decorated SVG with shadows) */}
            <WallsSvgLayer walls={plan.walls ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} selectedWallId={selectedWallId} />
            {/* Wall drawing preview (separate SVG for in-progress drawing) */}
            {mode === 'drawWalls' && wallDrawingPoints.length > 0 && (
              <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', left: 0, top: 0, zIndex: 2, pointerEvents: 'none' }}>
                <polyline
                  points={[...wallDrawingPoints, ...(wallPreviewPoint ? [wallPreviewPoint] : [])].map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="#1f2937" strokeWidth={7} strokeDasharray="8 4" strokeLinejoin="round" strokeLinecap="round"
                />
                {wallDrawingPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={5} fill="#2563eb" stroke="white" strokeWidth={2} />
                ))}
              </svg>
            )}

            {/* Wall corner handles (when selected) */}
            {selectedWallId && (plan.walls ?? []).filter(w => w.id === selectedWallId).map(wall =>
              wall.points.map((p, i) => (
                <div
                  key={`wh-${wall.id}-${i}`}
                  style={{
                    position: 'absolute', left: p.x - 7, top: p.y - 7, width: 14, height: 14,
                    background: 'white', border: '2px solid #2563eb', borderRadius: '50%',
                    cursor: 'grab', zIndex: 60, touchAction: 'none',
                  }}
                  onPointerDown={e => startWallPointDrag(e, wall.id, i)}
                  onPointerMove={handleWallPointMove}
                  onPointerUp={handleWallPointUp}
                />
              ))
            )}

            {/* Layer 3: Counter (with surface treatment) */}
            {plan.counter && (() => {
              const c = plan.counter!;
              const isSel = selectedElement?.type === 'counter';
              return (
                <div
                  style={{
                    position: 'absolute', left: c.x, top: c.y, width: c.width, height: c.height,
                    borderRadius: 6, border: isSel ? '2px solid #2563eb' : '2px solid #4b5563',
                    zIndex: 1, cursor: mode === 'select' ? (draggingId === 'counter' ? 'grabbing' : 'grab') : 'default',
                    touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSel ? '0 0 0 3px rgba(37,99,235,0.2)' : '0 2px 6px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                  }}
                  onPointerDown={e => handlePointerDown(e, 'counter', c.x, c.y)}
                  onPointerMove={e => handlePointerMove(e, 'counter', c.width, c.height)}
                  onPointerUp={e => handlePointerUp(e, 'counter', () => { deselectAll(); setSelectedElement({ type: 'counter', id: 'counter' }); })}
                  onContextMenu={e => handleContextMenu(e, 'counter', 'counter')}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, #6b7280, #6b7280 2px, #9ca3af 2px, #9ca3af 6px)' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)', borderRadius: '4px 4px 0 0' }} />
                  <span style={{ position: 'relative', fontSize: 12, fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Counter</span>
                  {isSel && (['nw','ne','sw','se'] as const).map(h => (
                    <div
                      key={h}
                      style={{
                        position: 'absolute', width: 10, height: 10, background: 'white', border: '2px solid #2563eb', borderRadius: 2, cursor: `${h}-resize`, zIndex: 60,
                        ...(h.includes('n') ? { top: -5 } : { bottom: -5 }),
                        ...(h.includes('w') ? { left: -5 } : { right: -5 }),
                      }}
                      onPointerDown={e => startResize(e, 'counter', 'counter', h, { x: c.x, y: c.y, width: c.width, height: c.height })}
                      onPointerMove={handleResizeMove}
                      onPointerUp={handleResizeUp}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Layer 4: Doors */}
            {(plan.doors ?? []).map(door => {
              const isSel = selectedElement?.type === 'door' && selectedElement.id === door.id;
              return (
                <div
                  key={door.id}
                  style={{
                    position: 'absolute', left: door.x - 18, top: door.y - 18, width: 36, height: 36,
                    background: isSel ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.9)',
                    border: isSel ? '2px solid #2563eb' : '1.5px solid #6b7280', borderRadius: 8,
                    zIndex: 1, cursor: mode === 'select' ? (draggingId === door.id ? 'grabbing' : 'grab') : 'default',
                    touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSel ? '0 0 0 3px rgba(37,99,235,0.2)' : '0 1px 4px rgba(0,0,0,0.1)',
                  }}
                  onPointerDown={e => handlePointerDown(e, door.id, door.x - 18, door.y - 18)}
                  onPointerMove={e => handlePointerMove(e, door.id, 36, 36)}
                  onPointerUp={e => handlePointerUp(e, door.id, () => { deselectAll(); setSelectedElement({ type: 'door', id: door.id }); })}
                  onContextMenu={e => handleContextMenu(e, door.id, 'door')}
                >
                  <DoorOpen className="w-5 h-5 text-gray-600" />
                </div>
              );
            })}

            {/* Decorative: Door arc sweeps (behind interactive handles) */}
            <DoorArcsSvgLayer doors={plan.doors ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} />

            {/* Layer 5: Labels */}
            {plan.labels.map(label => (
              <LabelElement
                key={label.id}
                label={label}
                isDragging={draggingId === label.id}
                onPointerDown={e => handlePointerDown(e, label.id, label.x, label.y)}
                onPointerMove={e => handlePointerMove(e, label.id, 120, 32)}
                onPointerUp={e => handlePointerUp(e, label.id)}
                onContextMenu={e => handleContextMenu(e, label.id, 'label')}
              />
            ))}

            {/* Layer 6: Merge group backgrounds */}
            <MergeGroupBackgrounds tables={plan.tables} tableStatusMap={tableStatusMap} />

            {/* Layer 7: Tables */}
            {plan.tables.map(table => {
              const { w, h } = tableSize(table.capacity);
              const sInfo = tableStatusMap.get(table.table_number);
              const tableCustomerName = sInfo?.orders.find(o => o.customer_name)?.customer_name ?? null;
              const isSearchMatch = searchQuery.trim()
                ? !!tableCustomerName?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                : false;
              return (
                <TableElement
                  key={table.id}
                  table={table}
                  statusInfo={sInfo}
                  isDragging={draggingId === table.id}
                  isSelected={editSelectedId === table.id}
                  isSearchMatch={isSearchMatch}
                  onPointerDown={e => handlePointerDown(e, table.id, table.x, table.y)}
                  onPointerMove={e => handlePointerMove(e, table.id, w, h)}
                  onPointerUp={e => handlePointerUp(e, table.id, () => setEditSelectedId(table.id))}
                  onContextMenu={e => handleContextMenu(e, table.id, 'table')}
                />
              );
            })}

            {/* Floating edit toolbar */}
            {editSelectedTable && (
              <FloatingToolbar
                table={editSelectedTable}
                onCapacityChange={c => changeCapacity(editSelectedTable.id, c)}
                onShapeChange={s => changeShape(editSelectedTable.id, s)}
                onDisplayNameCommit={(name) => commitDisplayName(editSelectedTable.id, name)}
                onDelete={() => { removeTable(editSelectedTable.id); setEditSelectedId(null); }}
                onViewStatus={() => setSheetTableId(editSelectedTable.id)}
                onDuplicate={() => duplicateTable(editSelectedTable.id)}
              />
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 min-w-[160px] rounded-lg border bg-white py-1 shadow-lg"
            style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          >
            {ctxMenu.type === 'label' && (
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                onClick={() => {
                  const l = plan.labels.find(l => l.id === ctxMenu.id);
                  if (l) setLabelEditForm({ id: l.id, text: l.text });
                  setCtxMenu(null);
                }}
              >
                ✏️ Edit label
              </button>
            )}
            {ctxMenu.type === 'table' && (
              <>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => { setEditSelectedId(ctxMenu.id); setCtxMenu(null); }}
                >
                  ✏️ Edit table
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => { duplicateTable(ctxMenu.id); setCtxMenu(null); }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate table
                </button>
              </>
            )}
            {ctxMenu.type === 'zone' && (
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                onClick={() => {
                  const z = (plan.zones ?? []).find(z => z.id === ctxMenu.id);
                  if (z) setZoneEditForm({ id: z.id, name: z.name, color: z.color });
                  setCtxMenu(null);
                }}
              >
                ✏️ Edit zone
              </button>
            )}
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => {
                if (ctxMenu.type === 'table') { removeTable(ctxMenu.id); if (editSelectedId === ctxMenu.id) setEditSelectedId(null); }
                else if (ctxMenu.type === 'wall') deleteWall(ctxMenu.id);
                else if (ctxMenu.type === 'counter') deleteCounter();
                else if (ctxMenu.type === 'door') deleteDoor(ctxMenu.id);
                else if (ctxMenu.type === 'zone') deleteZone(ctxMenu.id);
                else removeLabel(ctxMenu.id);
                setCtxMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {ctxMenu.type}
            </button>
          </div>
        </>
      )}

      {/* ── Label edit dialog ── */}
      <Dialog open={!!labelEditForm} onOpenChange={() => setLabelEditForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Label htmlFor="ltext">Label Text</Label>
            <Input
              id="ltext"
              value={labelEditForm?.text ?? ''}
              onChange={e => setLabelEditForm(f => f ? { ...f, text: e.target.value } : f)}
              placeholder="e.g. Patio, Main Hall, Bar"
              className="mt-1.5"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelEditForm(null)}>Cancel</Button>
            <Button onClick={commitLabelEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Zone edit dialog ── */}
      <Dialog open={!!zoneEditForm} onOpenChange={() => setZoneEditForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
          </DialogHeader>
          <div className="py-1 space-y-3">
            <div>
              <Label htmlFor="zname">Zone Name</Label>
              <Input
                id="zname"
                value={zoneEditForm?.name ?? ''}
                onChange={e => setZoneEditForm(f => f ? { ...f, name: e.target.value } : f)}
                placeholder="e.g. Indoor, Outdoor, AC Section"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1.5">
                {(['blue', 'green', 'orange', 'purple', 'pink'] as ZoneColor[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setZoneEditForm(f => f ? { ...f, color: c } : f)}
                    className={cn(
                      'w-8 h-8 rounded-lg border-2 transition-all',
                      zoneEditForm?.color === c ? 'border-gray-900 scale-110' : 'border-transparent',
                    )}
                    style={{ background: ZONE_COLORS_MAP[c].bg, borderColor: zoneEditForm?.color === c ? ZONE_COLORS_MAP[c].text : undefined }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneEditForm(null)}>Cancel</Button>
            <Button onClick={commitZoneEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Auto-number confirmation dialog ── */}
      <Dialog open={showAutoNumberConfirm} onOpenChange={setShowAutoNumberConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Auto-number Tables</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will renumber all {plan.tables.length} tables based on their position (left-to-right, top-to-bottom). Display names will be kept.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoNumberConfirm(false)}>Cancel</Button>
            <Button onClick={autoNumberTables}>Renumber</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Live status sheet ── */}
      <TableDetailSheet
        table={sheetTable}
        mergeGroup={sheetMergeGroup}
        allTables={plan.tables}
        tableStatusMap={tableStatusMap}
        statusInfo={sheetStatusInfo}
        onClose={() => setSheetTableId(null)}
        onMarkAvailable={markTableAvailable}
        onAcknowledge={acknowledgeWaiterCall}
        acknowledging={acknowledging}
        markingAvailable={markingAvailable}
        onGenerateBill={(tableOrders) => { setSheetTableId(null); setBillingOrders(tableOrders); }}
        onRefresh={fetchLiveData}
        onAdvanceStatus={advanceOrderStatus}
        onMergeTables={mergeTables}
        onUnmergeGroup={unmergeGroup}
      />

      {/* ── Billing sheet ── */}
      <BillingSheet
        orders={billingOrders ?? (paymentOrder ? [paymentOrder] : null)}
        restaurant={restaurant}
        onConfirm={handleBillingConfirm}
        onClose={() => { setPaymentOrder(null); setBillingOrders(null); }}
      />
    </div>
  );
}

// ─── FloatingToolbar ─────────────────────────────────────────────────────────

interface FloatingToolbarProps {
  table: FloorTable;
  onCapacityChange: (c: FloorCapacity) => void;
  onShapeChange: (s: FloorShape) => void;
  onDisplayNameCommit: (name: string) => void;
  onDelete: () => void;
  onViewStatus: () => void;
  onDuplicate: () => void;
}

function FloatingToolbar({
  table,
  onCapacityChange,
  onShapeChange,
  onDisplayNameCommit,
  onDelete,
  onViewStatus,
  onDuplicate,
}: FloatingToolbarProps) {
  const [nameVal, setNameVal] = useState(table.display_name ?? '');

  // Keep local input in sync when display_name changes externally
  useEffect(() => {
    setNameVal(table.display_name ?? '');
  }, [table.display_name]);

  const { w, h } = tableSize(table.capacity);
  // Show above by default; flip below if table is near the top
  const showBelow = table.y < 90;

  function commitName() {
    onDisplayNameCommit(nameVal);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: table.x + w / 2,
        top: showBelow ? table.y + h + 8 : table.y - 8,
        transform: showBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        zIndex: 100,
        pointerEvents: 'auto',
      }}
      // Stop pointer events bubbling to canvas (prevents deselect)
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-xl px-2 py-1.5 text-xs whitespace-nowrap">

        {/* Display name input */}
        <input
          type="text"
          maxLength={12}
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') { commitName(); (e.target as HTMLInputElement).blur(); } }}
          placeholder={`#${table.table_number}`}
          className="w-16 text-center border border-gray-200 rounded-md text-xs py-0.5 font-mono focus:outline-none focus:border-blue-400"
          title="Table name (e.g. L1, VIP)"
        />

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Shape toggle (only relevant for 2 and 4-seat tables) */}
        {table.capacity <= 4 && (
          <>
            <button
              onClick={() => onShapeChange(table.shape === 'round' ? 'square' : 'round')}
              className="px-1.5 py-0.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
              title={`Switch to ${table.shape === 'round' ? 'square' : 'round'}`}
            >
              {table.shape === 'round' ? '⭕' : '⬛'}
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
          </>
        )}

        {/* Capacity buttons */}
        {([2, 4, 6, 8] as FloorCapacity[]).map(c => (
          <button
            key={c}
            onClick={() => onCapacityChange(c)}
            className={cn(
              'w-6 h-6 rounded-md text-xs font-medium transition-colors',
              table.capacity === c
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100',
            )}
            title={`${c} seats`}
          >
            {c}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* View live status */}
        <button
          onClick={onViewStatus}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="View live status"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        {/* Duplicate */}
        <button
          onClick={onDuplicate}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="Duplicate table"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
          title="Delete table (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── TableDetailSheet ─────────────────────────────────────────────────────────

interface TableDetailSheetProps {
  table: FloorTable | null;
  mergeGroup?: FloorTable[];
  allTables: FloorTable[];
  tableStatusMap: Map<number, TableStatusInfo>;
  statusInfo: TableStatusInfo | null;
  onClose: () => void;
  onMarkAvailable: (tableNumbers: number[]) => Promise<void>;
  onAcknowledge: (callId: string) => Promise<void>;
  acknowledging: boolean;
  markingAvailable: boolean;
  onRefresh: () => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
  onGenerateBill: (orders: Order[]) => void;
  onMergeTables: (tableIds: string[]) => void;
  onUnmergeGroup: (mergeGroupId: string) => void;
}

function TableDetailSheet({
  table,
  mergeGroup,
  allTables,
  tableStatusMap,
  statusInfo,
  onClose,
  onMarkAvailable,
  onAcknowledge,
  acknowledging,
  markingAvailable,
  onRefresh,
  onAdvanceStatus,
  onGenerateBill,
  onMergeTables,
  onUnmergeGroup,
}: TableDetailSheetProps) {
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());

  const open = !!table && !!statusInfo;
  if (!open) return <Sheet open={false} onOpenChange={o => { if (!o) onClose(); }} />;

  const colors = STATUS_COLORS[statusInfo.status];
  const isMerged = mergeGroup && mergeGroup.length > 1;
  const mergedTitle = isMerged
    ? mergeGroup.map(t => tableLabel(t)).join(' + ')
    : `Table ${tableLabel(table)}`;
  const totalCapacity = isMerged
    ? mergeGroup.reduce((sum, t) => sum + t.capacity, 0)
    : table.capacity;
  const tableNumbers = isMerged
    ? mergeGroup.map(t => t.table_number)
    : [table.table_number];

  // IDs already in this table's merge group
  const currentGroupIds = new Set(
    isMerged ? mergeGroup.map(t => t.id) : [table.id],
  );

  function openMergePicker() {
    setMergeSelection(new Set());
    setShowMergePicker(true);
  }

  function toggleMergeSelection(id: string) {
    setMergeSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmMerge() {
    const allIds = [...Array.from(currentGroupIds), ...Array.from(mergeSelection)];
    onMergeTables(allIds);
    setShowMergePicker(false);
    setMergeSelection(new Set());
    // Refresh live data so the sheet immediately shows combined orders
    onRefresh();
  }

  return (
    <Sheet open onOpenChange={o => { if (!o) { onClose(); setShowMergePicker(false); } }}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 overflow-hidden sm:max-w-md">
        <SheetHeader
          className="border-b p-4 flex-shrink-0"
          style={{ borderLeftColor: isMerged ? '#8b5cf6' : colors.border, borderLeftWidth: 4 }}
        >
          <div className="flex items-center gap-3 pr-8">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: isMerged ? 'rgba(139,92,246,0.12)' : colors.bg, color: isMerged ? '#7c3aed' : colors.text }}
            >
              {isMerged ? <Link2 size={18} /> : tableLabel(table)}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle>{mergedTitle}{isMerged ? ' (merged)' : ''}</SheetTitle>
              <SheetDescription>{totalCapacity} seats{isMerged ? ` · ${mergeGroup.length} tables` : ` · ${table.shape}`}</SheetDescription>
            </div>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              {STATUS_LABELS[statusInfo.status]}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Merge picker view */}
          {showMergePicker ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Select tables to merge with</p>
                <button
                  onClick={() => setShowMergePicker(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <div className="space-y-1.5">
                {allTables
                  .filter(t => t.id !== table.id)
                  .map(t => {
                    const tStatus = tableStatusMap.get(t.table_number);
                    const tColors = tStatus ? STATUS_COLORS[tStatus.status] : null;
                    const isInGroup = currentGroupIds.has(t.id);
                    const isSelected = mergeSelection.has(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => { if (!isInGroup) toggleMergeSelection(t.id); }}
                        disabled={isInGroup}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                          isInGroup
                            ? 'border-purple-200 bg-purple-50 opacity-60 cursor-not-allowed'
                            : isSelected
                              ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                            isInGroup || isSelected
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-gray-300',
                          )}
                        >
                          {(isInGroup || isSelected) && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">Table {tableLabel(t)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t.capacity} seats</span>
                        </div>
                        {tColors && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: tColors.bg, color: tColors.text, border: `1px solid ${tColors.border}` }}
                          >
                            {STATUS_LABELS[tStatus!.status]}
                          </span>
                        )}
                        {isInGroup && (
                          <span className="text-[10px] text-purple-600 font-medium flex-shrink-0">In group</span>
                        )}
                      </button>
                    );
                  })}
              </div>
              {mergeSelection.size > 0 && (
                <Button
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={confirmMerge}
                >
                  <Merge className="w-4 h-4 mr-2" />
                  Confirm Merge ({currentGroupIds.size + mergeSelection.size} tables)
                </Button>
              )}
            </div>
          ) : (
            <>
              {statusInfo.waiterCall && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <Bell className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Waiter Called</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {formatDistanceToNow(new Date(statusInfo.waiterCall.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                    onClick={() => onAcknowledge(statusInfo.waiterCall!.id)}
                    disabled={acknowledging}
                  >
                    {acknowledging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Acknowledge'}
                  </Button>
                </div>
              )}

              {statusInfo.orders.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold mb-3">Active Orders ({statusInfo.orders.length})</p>
                  <div className="space-y-3">
                    {statusInfo.orders.map(order => (
                      <OrderCard key={order.id} order={order} onRefresh={onRefresh} onAdvanceStatus={onAdvanceStatus} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <p className="text-sm">No active orders</p>
                  <p className="text-xs mt-1">This table is available</p>
                </div>
              )}
            </>
          )}
        </div>

        {!showMergePicker && (
          <SheetFooter className="border-t bg-gray-50 p-4 flex-col gap-2 flex-shrink-0">
            {statusInfo.orders.length > 0 && (
              <>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => onGenerateBill(statusInfo.orders)}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Generate Bill ({statusInfo.orders.length} order{statusInfo.orders.length > 1 ? 's' : ''})
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onMarkAvailable(tableNumbers)}
                  disabled={markingAvailable}
                >
                  {markingAvailable
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Clearing table…</>
                    : 'Mark Available'}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="w-full text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
              onClick={openMergePicker}
            >
              <Merge className="w-4 h-4 mr-2" />
              Merge Tables
            </Button>
            {isMerged && table.merge_group_id && (
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => onUnmergeGroup(table.merge_group_id!)}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Unmerge All
              </Button>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/orders">View Full Orders Dashboard</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

const ORDER_STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  placed:    { bg: '#fef9c3', text: '#854d0e', border: '#fde047', label: 'Placed'    },
  ready:     { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'Ready'     },
  delivered: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: 'Delivered' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Cancelled' },
};

function OrderCard({
  order,
  onRefresh,
  onAdvanceStatus,
}: {
  order: Order;
  onRefresh: () => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
}) {
  const st = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.placed;
  const [noteText, setNoteText]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const nextActionLabel = ORDER_ACTION_LABELS[order.status];

  async function handleAdvance() {
    setAdvancing(true);
    try {
      await onAdvanceStatus(order.id, order.status);
    } finally {
      setAdvancing(false);
    }
  }

  async function addNote() {
    const text = noteText.trim();
    if (!text) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const newNote: OrderNote = { id: crypto.randomUUID(), text, created_at: new Date().toISOString() };
      const existing: OrderNote[] = order.internal_notes ?? [];
      const { error } = await supabase
        .from('orders')
        .update({ internal_notes: [...existing, newNote] })
        .eq('id', order.id);
      if (error) { toast.error('Failed to add note'); return; }
      setNoteText('');
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const supabase = createClient();
    const updated = (order.internal_notes ?? []).filter(n => n.id !== noteId);
    const { error } = await supabase
      .from('orders')
      .update({ internal_notes: updated })
      .eq('id', order.id);
    if (error) { toast.error('Failed to delete note'); return; }
    onRefresh();
  }

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Order #{order.order_number}</span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded border"
              style={{ background: st.bg, color: st.text, borderColor: st.border }}
            >
              {st.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <span className="text-sm font-semibold text-right flex-shrink-0">{formatPrice(order.total)}</span>
      </div>
      {order.items && order.items.length > 0 && (
        <ul className="space-y-1 pt-2 border-t">
          {order.items.map(item => (
            <li key={item.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{item.quantity}× {item.name}{item.notes ? <span className="italic ml-1">({item.notes})</span> : null}</span>
              <span className="flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      {nextActionLabel && (
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="w-full mt-1 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {advancing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {nextActionLabel}
        </button>
      )}

      {/* Internal notes */}
      <div className="pt-2 border-t space-y-2">
        {(order.internal_notes ?? []).length > 0 && (
          <ul className="space-y-1.5">
            {(order.internal_notes ?? []).map(note => (
              <li key={note.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">{note.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
                  title="Delete note"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            placeholder="Add internal note…"
            className="flex-1 text-xs border rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={addNote}
            disabled={saving || !noteText.trim()}
            className="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ViewCanvas (mobile view-only) ───────────────────────────────────────────

interface ViewCanvasProps {
  plan: FloorPlan;
  tableStatusMap: Map<number, TableStatusInfo>;
  onTableClick: (table: FloorTable) => void;
}

function ViewCanvas({ plan, tableStatusMap, onTableClick }: ViewCanvasProps) {
  return (
    <div
      style={{
        width: CANVAS_W, height: CANVAS_H, position: 'relative',
        ...getFloorBackground(plan.floorStyle),
      }}
      className="bg-white"
    >
      {/* Zones (with outdoor pattern) */}
      {(plan.zones ?? []).map(zone => {
        const zc = ZONE_COLORS_MAP[zone.color];
        const outdoor = isOutdoorZone(zone.name);
        return (
          <div
            key={zone.id}
            style={{
              position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height,
              background: zc.bg, border: `1.5px dashed ${zc.border}`, borderRadius: 8,
              zIndex: 0, pointerEvents: 'none',
              ...(outdoor ? OUTDOOR_PATTERN_CSS : {}),
            }}
          >
            <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontWeight: 600, color: zc.text, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{zone.name}</span>
          </div>
        );
      })}

      {/* Walls (decorated with shadows) */}
      <WallsSvgLayer walls={plan.walls ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} />

      {/* Counter (with surface treatment) */}
      {plan.counter && (
        <CounterElement counter={plan.counter} />
      )}

      {/* Doors (architectural arc sweeps) */}
      <DoorArcsSvgLayer doors={plan.doors ?? []} canvasW={CANVAS_W} canvasH={CANVAS_H} />

      {/* Labels */}
      {plan.labels.map(l => <LabelElement key={l.id} label={l} viewOnly />)}

      {/* Merge group backgrounds */}
      <MergeGroupBackgrounds tables={plan.tables} tableStatusMap={tableStatusMap} />

      {/* Tables */}
      {plan.tables.map(t => (
        <TableElement
          key={t.id}
          table={t}
          viewOnly
          statusInfo={tableStatusMap.get(t.table_number)}
          onClick={() => onTableClick(t)}
        />
      ))}
    </div>
  );
}

// ─── TableElement ─────────────────────────────────────────────────────────────

interface TableElementProps {
  table: FloorTable;
  viewOnly?: boolean;
  statusInfo?: TableStatusInfo;
  isDragging?: boolean;
  isSelected?: boolean;
  isSearchMatch?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TableElement({
  table, viewOnly, statusInfo, isDragging, isSelected, isSearchMatch,
  onClick, onPointerDown, onPointerMove, onPointerUp, onContextMenu,
}: TableElementProps) {
  const { w, h } = tableSize(table.capacity);
  const isRound  = table.shape === 'round';
  const status   = statusInfo?.status;
  const colors   = status ? STATUS_COLORS[status] : null;

  const bg     = isDragging ? '#e0e7ff' : (colors?.bg     ?? '#f0f4ff');
  const border = isDragging ? '#4f46e5' : isSelected ? '#2563eb' : (colors?.border ?? '#818cf8');
  const text   = isDragging ? '#3730a3' : (colors?.text   ?? '#3730a3');
  const sub    = isDragging ? '#6366f1' : (colors?.sub    ?? '#6366f1');

  const needsAttention = status === 'needs_attention' && !isDragging;

  // Show customer name for occupied tables (suppress for tables in a merge group)
  const customerName = statusInfo?.orders.find(o => o.customer_name)?.customer_name ?? null;
  const inMergeGroup = !!table.merge_group_id;
  const showName = customerName && !inMergeGroup;

  return (
    <div
      style={{
        position: 'absolute', left: table.x, top: table.y, width: w, height: h,
        cursor: viewOnly ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 50 : isSelected ? 10 : 2,
        overflow: 'visible',
      }}
      className={needsAttention ? 'animate-pulse' : undefined}
      title={customerName ?? undefined}
      onClick={viewOnly ? onClick : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      {/* Search match highlight ring */}
      {isSearchMatch && (
        <div style={{
          position: 'absolute', inset: -6,
          borderRadius: isRound ? '50%' : 16,
          border: '3px solid #eab308',
          boxShadow: '0 0 0 3px rgba(234,179,8,0.25)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Selection ring */}
      {isSelected && (
        <div style={{
          position: 'absolute', inset: -4,
          borderRadius: isRound ? '50%' : 14,
          border: '2px solid #2563eb',
          opacity: 0.5,
          pointerEvents: 'none',
        }} />
      )}

      <div style={{
        width: '100%', height: '100%',
        borderRadius: isRound ? '50%' : 10,
        background: bg,
        border: `2px solid ${border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        filter: TABLE_DROP_SHADOW,
        boxShadow: isDragging
          ? '0 8px 24px rgba(79,70,229,0.25)'
          : isSelected
            ? '0 0 0 3px rgba(37,99,235,0.2), 0 2px 8px rgba(0,0,0,0.12)'
            : needsAttention
              ? '0 0 0 3px rgba(239,68,68,0.25)'
              : undefined,
        transition: isDragging ? 'none' : 'box-shadow 0.15s, background 0.25s, border-color 0.25s',
        padding: '0 4px',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: text, lineHeight: 1 }}>
          {tableLabel(table)}
        </span>
        {showName ? (
          <span style={{
            fontSize: 13, fontWeight: 700, color: text, marginTop: 3, lineHeight: 1.1,
            maxWidth: 'calc(100% - 4px)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', textAlign: 'center',
          }}>
            {shortName(customerName)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: sub, marginTop: 3 }}>
            {table.capacity}p
          </span>
        )}
      </div>
    </div>
  );
}

// ─── MergeGroupBackgrounds ──────────────────────────────────────────────────

function MergeGroupBackgrounds({ tables, tableStatusMap }: {
  tables: FloorTable[];
  tableStatusMap?: Map<number, TableStatusInfo>;
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
      if (!groupCustomerName && tableStatusMap) {
        const info = tableStatusMap.get(t.table_number);
        groupCustomerName = info?.orders.find(o => o.customer_name)?.customer_name ?? null;
      }
    }

    const headerParts = [`Merged · ${groupTables.length} tables · ${totalSeats} seats`];
    if (groupCustomerName) headerParts.push(`· ${shortName(groupCustomerName)}`);

    rects.push(
      <div
        key={groupId}
        title={groupCustomerName ?? undefined}
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
        <div style={{
          position: 'absolute',
          top: 2,
          left: 8,
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(139,92,246,0.55)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}>
          {headerParts.join(' ')}
        </div>
      </div>,
    );
  });

  if (rects.length === 0) return null;
  return <>{rects}</>;
}

// ─── LabelElement ─────────────────────────────────────────────────────────────

interface LabelElementProps {
  label: FloorLabel;
  viewOnly?: boolean;
  isDragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function LabelElement({ label, viewOnly, isDragging, onPointerDown, onPointerMove, onPointerUp, onContextMenu }: LabelElementProps) {
  return (
    <div
      style={{
        position: 'absolute', left: label.x, top: label.y,
        cursor: viewOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none', zIndex: isDragging ? 50 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <div style={{
        padding: '4px 12px', borderRadius: 5,
        background: isDragging ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)',
        border: '1.5px dashed #94a3b8', fontSize: 13, fontWeight: 600,
        color: '#475569', whiteSpace: 'nowrap',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
        letterSpacing: '0.03em', textTransform: 'uppercase',
      }}>
        {label.text}
      </div>
    </div>
  );
}
