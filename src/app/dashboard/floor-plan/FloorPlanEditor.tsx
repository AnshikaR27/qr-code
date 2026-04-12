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
import type {
  FloorCapacity,
  FloorLabel,
  FloorPlan,
  FloorShape,
  FloorTable,
  Order,
  OrderNote,
  OrderStatus,
  Restaurant,
  WaiterCall,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID     = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
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
type EditorMode = 'select' | 'addTable' | 'addLabel';

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
    id: string; type: 'table' | 'label'; screenX: number; screenY: number;
  } | null>(null);

  // ── Live status state ──────────────────────────────────────────────────────
  const [activeOrders, setActiveOrders]           = useState<Order[]>([]);
  const [activeWaiterCalls, setActiveWaiterCalls] = useState<WaiterCall[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [acknowledging, setAcknowledging]         = useState(false);
  const [markingAvailable, setMarkingAvailable]   = useState(false);
  const [paymentOrder, setPaymentOrder]           = useState<Order | null>(null);
  const [billingOrders, setBillingOrders]         = useState<Order[] | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef            = useRef<HTMLDivElement>(null);
  const saveTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffset           = useRef({ x: 0, y: 0 });
  const dragMoved            = useRef(false);
  const pointerDownClient    = useRef({ x: 0, y: 0 });
  const realtimeConnectedRef = useRef(false);
  /** Single-level undo snapshot taken before every mutation. */
  const previousPlan         = useRef<FloorPlan | null>(null);

  // ── Responsive check ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when focus is inside an input / textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        setCtxMenu(null);
        setMode('select');
        setEditSelectedId(null);
        return;
      }

      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && editSelectedId) {
        e.preventDefault();
        removeTable(editSelectedId);
        setEditSelectedId(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSelectedId]);

  // ── Sync merge state from the `tables` DB table into local plan ─────────
  async function syncMergeState() {
    const supabase = createClient();
    const { data: dbTables } = await supabase
      .from('tables')
      .select('id, merge_group_id, merged_with')
      .eq('restaurant_id', restaurant.id);
    if (!dbTables) return;
    const mergeMap = new Map(dbTables.map(r => [r.id, { merge_group_id: r.merge_group_id ?? null, merged_with: r.merged_with ?? null }]));
    setPlan(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        const db = mergeMap.get(t.id);
        if (!db) return t;
        if (t.merge_group_id === db.merge_group_id && t.merged_with === db.merged_with) return t;
        return { ...t, merge_group_id: db.merge_group_id, merged_with: db.merged_with };
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

    // Derive table merge state directly from orders (no extra DB call,
    // no race condition — the orders already carry merge_group_id).
    const mergeGroups = new Map<string, Set<string>>();
    for (const o of (orders ?? [])) {
      if (o.merge_group_id && o.table_id) {
        const set = mergeGroups.get(o.merge_group_id) ?? new Set<string>();
        set.add(o.table_id);
        mergeGroups.set(o.merge_group_id, set);
      }
    }
    // Build tableId → merge info lookup
    const tableMerge = new Map<string, { merge_group_id: string; merged_with: string[] }>();
    Array.from(mergeGroups.entries()).forEach(([groupId, tableIdSet]) => {
      const ids = Array.from(tableIdSet) as string[];
      if (ids.length >= 2) {
        ids.forEach(tid => {
          tableMerge.set(tid, { merge_group_id: groupId, merged_with: ids.filter(id => id !== tid) });
        });
      }
    });

    console.log('[FloorPlan] fetchLiveData — orders:', (orders ?? []).length,
      'with merge_group_id:', (orders ?? []).filter(o => o.merge_group_id).length,
      'tableMerge size:', tableMerge.size);

    if (tableMerge.size > 0) {
      console.log('[FloorPlan] tableMerge entries:', JSON.stringify(Array.from(tableMerge.entries())));
    }

    setPlan(prev => {
      const next = {
        ...prev,
        tables: prev.tables.map(t => {
          const m = tableMerge.get(t.id);
          if (m) {
            if (t.merge_group_id === m.merge_group_id) return t;
            return { ...t, merge_group_id: m.merge_group_id, merged_with: m.merged_with };
          }
          // Don't clear merge state here — a subsequent fetchLiveData may
          // arrive before the orders DB reflects the merge, which would
          // erase valid state. Clearing is handled by unmergeGroup / payment.
          return t;
        }),
      };
      const mergedTables = next.tables.filter(t => t.merge_group_id);
      if (mergedTables.length > 0) {
        console.log('[FloorPlan] plan tables with merge_group_id after update:', mergedTables.map(t => ({ id: t.id, table_number: t.table_number, merge_group_id: t.merge_group_id })));
      }
      return next;
    });
  }

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
      //    Upsert by id — insert new rows, update table_number if it changed.
      //    We never delete rows (orders may reference them).
      if (next.tables.length > 0) {
        await supabase
          .from('tables')
          .upsert(
            next.tables.map(t => ({
              id: t.id,
              restaurant_id: restaurant.id,
              table_number: t.table_number,
              display_name: t.display_name ?? null,
            })),
            { onConflict: 'restaurant_id,table_number' },
          );
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

    // Deselect on empty canvas click
    setEditSelectedId(null);

    const rect = canvasRef.current!.getBoundingClientRect();
    const x    = snap(Math.max(0, e.clientX - rect.left));
    const y    = snap(Math.max(0, e.clientY - rect.top));

    if (mode === 'addTable') {
      placeTable(x, y); // placeTable already calls setMode('select')
    } else if (mode === 'addLabel') {
      placeLabel(x, y);
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
      x: e.clientX - rect.left - elemX,
      y: e.clientY - rect.top  - elemY,
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
    const rawX = e.clientX - rect.left - dragOffset.current.x;
    const rawY = e.clientY - rect.top  - dragOffset.current.y;
    const x    = snap(Math.max(0, Math.min(CANVAS_W - elemW, rawX)));
    const y    = snap(Math.max(0, Math.min(CANVAS_H - elemH, rawY)));

    setPlan(prev => ({
      tables: prev.tables.map(t => t.id === id ? { ...t, x, y } : t),
      labels: prev.labels.map(l => l.id === id ? { ...l, x, y } : l),
    }));
  }

  function handlePointerUp(e: React.PointerEvent, id: string, isTable: boolean) {
    if (draggingId !== id) return;
    setDraggingId(null);
    if (!dragMoved.current) {
      // tap — select the table (or ignore for labels)
      if (isTable) setEditSelectedId(id);
    } else {
      // drag ended — just save the new position
      setPlan(prev => {
        previousPlan.current = prev;
        scheduleSave(prev);
        return prev;
      });
    }
  }

  /** Merge selected tables into a group (called from TableDetailSheet) */
  function mergeTables(tableIds: string[]) {
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

    // Sync merge_group_id to active orders at these tables so the
    // KitchenDashboard picks it up via its realtime subscription on orders.
    // Also sync to the tables DB.
    const supabase = createClient();
    supabase
      .from('orders')
      .update({ merge_group_id: groupId })
      .eq('restaurant_id', restaurant.id)
      .in('table_id', tableIds)
      .is('payment_method', null)
      .or('status.eq.placed,status.eq.ready')
      .select('id, table_id, merge_group_id')
      .then(({ data, error }) => {
        console.log('[FloorPlan] merge orders sync result:', { data, error, tableIds, groupId });
      });
    supabase
      .from('tables')
      .update({ merge_group_id: groupId, merged_with: tableIds })
      .in('id', tableIds)
      .then();

    const labels = plan.tables
      .filter(t => tableIds.includes(t.id))
      .map(t => tableLabel(t))
      .join(' + ');
    toast.success(`Tables ${labels} merged`);
  }

  /** Unmerge all tables in a merge group */
  function unmergeGroup(mergeGroupId: string) {
    // Collect table IDs before clearing so we can update orders
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
    if (tableIds.length > 0) {
      const supabase = createClient();
      supabase
        .from('orders')
        .update({ merge_group_id: null })
        .eq('restaurant_id', restaurant.id)
        .in('table_id', tableIds)
        .or('status.eq.placed,status.eq.ready')
        .then();
      supabase
        .from('tables')
        .update({ merge_group_id: null, merged_with: null })
        .in('id', tableIds)
        .then();
    }

    toast.success('Tables unmerged');
  }

  // ── Context menu ─────────────────────────────────────────────────────────
  function handleContextMenu(
    e: React.MouseEvent,
    id: string,
    type: 'table' | 'label',
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, type, screenX: e.clientX, screenY: e.clientY });
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
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-white flex-shrink-0">
        <h1 className="text-base font-semibold mr-1">Floor Plan</h1>
        <div className="h-5 w-px bg-border mx-1" />

        <Button
          size="sm"
          variant={mode === 'addTable' ? 'default' : 'outline'}
          onClick={() => { setMode(m => m === 'addTable' ? 'select' : 'addTable'); setEditSelectedId(null); setPendingDisplayName(''); }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Table
        </Button>

        <Button
          size="sm"
          variant={mode === 'addLabel' ? 'default' : 'outline'}
          onClick={() => { setMode(m => m === 'addLabel' ? 'select' : 'addLabel'); setEditSelectedId(null); }}
        >
          <Type className="w-4 h-4 mr-1.5" />
          Add Label
        </Button>

        {mode !== 'select' && (
          <button
            onClick={() => setMode('select')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-1"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}

        {/* Undo button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleUndo}
          disabled={!previousPlan.current}
          className="ml-1"
          title="Undo last action (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </Button>

        <div className="ml-auto flex items-center gap-4">
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {realtimeConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-green-700">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-600">Reconnecting…</span>
              </>
            )}
          </div>
          {/* Save status */}
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
      </div>

      {/* ── Add-table config bar ── */}
      {mode === 'addTable' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 bg-blue-50 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Name:</span>
            <input
              type="text"
              value={pendingDisplayName}
              onChange={e => setPendingDisplayName(e.target.value)}
              placeholder="e.g. L1, VIP, P3"
              maxLength={12}
              className="w-28 text-xs border border-blue-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Shape:</span>
            {(['round', 'square'] as FloorShape[]).map(s => (
              <button key={s} type="button" onClick={() => setPendingShape(s)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  pendingShape === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
                )}>
                {s === 'round' ? '⭕ Round' : '⬛ Square'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Seats:</span>
            {([2, 4, 6, 8] as FloorCapacity[]).map(c => (
              <button key={c} type="button" onClick={() => setPendingCapacity(c)}
                className={cn(
                  'w-8 h-7 text-xs rounded-md border transition-colors',
                  pendingCapacity === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
                )}>
                {c}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Preview:</span>
            <div style={{
              width:  Math.round(tableSize(pendingCapacity).w * 0.35),
              height: Math.round(tableSize(pendingCapacity).h * 0.35),
              borderRadius: pendingShape === 'round' ? '50%' : 4,
              background: 'rgba(59,130,246,0.15)',
              border: '1.5px solid #3b82f6',
              flexShrink: 0,
            }} />
          </div>
          <span className="text-xs text-blue-600 ml-auto">
            🖱 Click on the canvas to place
          </span>
        </div>
      )}

      {mode === 'addLabel' && (
        <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700 flex-shrink-0">
          🖱 Click anywhere on the floor to place a section label
        </div>
      )}

      {/* ── Canvas scroll area ── */}
      <div className="flex-1 overflow-auto p-4 bg-gray-100">
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            position: 'relative',
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
            backgroundSize: `${GRID}px ${GRID}px`,
            cursor: mode !== 'select' ? 'crosshair' : 'default',
            userSelect: 'none',
          }}
          className="rounded-xl border bg-white shadow-sm"
        >
          {plan.labels.map(label => (
            <LabelElement
              key={label.id}
              label={label}
              isDragging={draggingId === label.id}
              onPointerDown={e => handlePointerDown(e, label.id, label.x, label.y)}
              onPointerMove={e => handlePointerMove(e, label.id, 120, 32)}
              onPointerUp={e => handlePointerUp(e, label.id, false)}
              onContextMenu={e => handleContextMenu(e, label.id, 'label')}
            />
          ))}

          {/* Merge group backgrounds — rendered behind tables */}
          <MergeGroupBackgrounds tables={plan.tables} />

          {plan.tables.map(table => {
            const { w, h } = tableSize(table.capacity);
            return (
              <TableElement
                key={table.id}
                table={table}
                statusInfo={tableStatusMap.get(table.table_number)}
                isDragging={draggingId === table.id}
                isSelected={editSelectedId === table.id}
                onPointerDown={e => handlePointerDown(e, table.id, table.x, table.y)}
                onPointerMove={e => handlePointerMove(e, table.id, w, h)}
                onPointerUp={e => handlePointerUp(e, table.id, true)}
                onContextMenu={e => handleContextMenu(e, table.id, 'table')}
              />
            );
          })}

          {/* Floating edit toolbar — renders inside canvas so it stays in flow */}
          {editSelectedTable && (
            <FloatingToolbar
              table={editSelectedTable}
              onCapacityChange={c => changeCapacity(editSelectedTable.id, c)}
              onShapeChange={s => changeShape(editSelectedTable.id, s)}
              onDisplayNameCommit={(name) => commitDisplayName(editSelectedTable.id, name)}
              onDelete={() => { removeTable(editSelectedTable.id); setEditSelectedId(null); }}
              onViewStatus={() => setSheetTableId(editSelectedTable.id)}
            />
          )}
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
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                onClick={() => { setEditSelectedId(ctxMenu.id); setCtxMenu(null); }}
              >
                ✏️ Edit table
              </button>
            )}
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => {
                if (ctxMenu.type === 'table') { removeTable(ctxMenu.id); if (editSelectedId === ctxMenu.id) setEditSelectedId(null); }
                else removeLabel(ctxMenu.id);
                setCtxMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {ctxMenu.type === 'table' ? 'Delete table' : 'Delete label'}
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
}

function FloatingToolbar({
  table,
  onCapacityChange,
  onShapeChange,
  onDisplayNameCommit,
  onDelete,
  onViewStatus,
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
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: `${GRID}px ${GRID}px`,
      }}
      className="bg-white"
    >
      {plan.labels.map(l => <LabelElement key={l.id} label={l} viewOnly />)}
      <MergeGroupBackgrounds tables={plan.tables} />
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
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TableElement({
  table, viewOnly, statusInfo, isDragging, isSelected,
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

  return (
    <div
      style={{
        position: 'absolute', left: table.x, top: table.y, width: w, height: h,
        cursor: viewOnly ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 50 : isSelected ? 10 : 2,
      }}
      className={needsAttention ? 'animate-pulse' : undefined}
      onClick={viewOnly ? onClick : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
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
        boxShadow: isDragging
          ? '0 8px 24px rgba(79,70,229,0.25)'
          : isSelected
            ? '0 0 0 3px rgba(37,99,235,0.2), 0 2px 8px rgba(0,0,0,0.12)'
            : needsAttention
              ? '0 0 0 3px rgba(239,68,68,0.25)'
              : '0 2px 6px rgba(0,0,0,0.08)',
        transition: isDragging ? 'none' : 'box-shadow 0.15s, background 0.25s, border-color 0.25s',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: text, lineHeight: 1 }}>
          {tableLabel(table)}
        </span>
        <span style={{ fontSize: 11, color: sub, marginTop: 3 }}>
          {table.capacity}p
        </span>
      </div>
    </div>
  );
}

// ─── MergeGroupBackgrounds ──────────────────────────────────────────────────

function MergeGroupBackgrounds({ tables }: { tables: FloorTable[] }) {
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
    for (const t of groupTables) {
      const s = tableSize(t.capacity);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + s.w);
      maxY = Math.max(maxY, t.y + s.h);
      totalSeats += t.capacity;
    }

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
          Merged · {groupTables.length} tables · {totalSeats} seats
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
