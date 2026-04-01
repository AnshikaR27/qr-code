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
import type {
  FloorCapacity,
  FloorLabel,
  FloorPlan,
  FloorShape,
  FloorTable,
  Order,
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

/** Size by capacity. Round tables use border-radius:50%, square use 10px. */
function tableSize(capacity: FloorCapacity) {
  if (capacity <= 2) return { w: 70, h: 70 };
  if (capacity <= 4) return { w: 90, h: 90 };
  if (capacity <= 6) return { w: 130, h: 80 };
  return                    { w: 160, h: 80 };
}

// ─── Live status ──────────────────────────────────────────────────────────────

type TableLiveStatus = 'available' | 'occupied' | 'ready' | 'needs_attention';

interface TableStatusInfo {
  status: TableLiveStatus;
  orders: Order[];
  waiterCall: WaiterCall | null;
}

const STATUS_COLORS: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', text: '#15803d', sub: '#16a34a' },
  occupied:        { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#b45309', sub: '#d97706' },
  ready:           { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#1d4ed8', sub: '#2563eb' },
  needs_attention: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#b91c1c', sub: '#dc2626' },
};

const STATUS_LABELS: Record<TableLiveStatus, string> = {
  available:       'Available',
  occupied:        'Occupied',
  ready:           'Ready',
  needs_attention: 'Needs Attention',
};

// ─── Editor types ─────────────────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved';
type EditorMode = 'select' | 'addTable' | 'addLabel';

interface CtxMenu {
  id: string;
  type: 'table' | 'label';
  screenX: number;
  screenY: number;
}

interface EditForm {
  id: string;
  type: 'table' | 'label';
  table_number: number;
  shape: FloorShape;
  capacity: FloorCapacity;
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
  const [ctxMenu, setCtxMenu]         = useState<CtxMenu | null>(null);
  const [editForm, setEditForm]       = useState<EditForm | null>(null);
  const [placingTable, setPlacingTable] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  // Pending shape/capacity chosen before the user clicks to place
  const [pendingShape, setPendingShape]       = useState<FloorShape>('round');
  const [pendingCapacity, setPendingCapacity] = useState<FloorCapacity>(4);

  // ── Live status state ──────────────────────────────────────────────────────
  const [activeOrders, setActiveOrders]           = useState<Order[]>([]);
  const [activeWaiterCalls, setActiveWaiterCalls] = useState<WaiterCall[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [selectedTableId, setSelectedTableId]     = useState<string | null>(null);
  const [acknowledging, setAcknowledging]         = useState(false);
  const [markingAvailable, setMarkingAvailable]   = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef            = useRef<HTMLDivElement>(null);
  const saveTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffset           = useRef({ x: 0, y: 0 });
  const dragMoved            = useRef(false);
  const pointerDownClient    = useRef({ x: 0, y: 0 });
  const realtimeConnectedRef = useRef(false);

  // ── Responsive check ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCtxMenu(null); setMode('select'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Live data fetch ────────────────────────────────────────────────────────
  async function fetchLiveData() {
    const supabase = createClient();
    const [{ data: orders }, { data: calls }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', restaurant.id)
        .in('status', ['placed', 'preparing', 'ready']),
      supabase
        .from('waiter_calls')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'pending'),
    ]);
    setActiveOrders(orders ?? []);
    setActiveWaiterCalls(calls ?? []);
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
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED';
        realtimeConnectedRef.current = connected;
        setRealtimeConnected(connected);
      });

    // Fallback poll every 30s when realtime is disconnected
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
  function getTableStatusInfo(tableId: string): TableStatusInfo {
    const orders     = activeOrders.filter(o => o.table_id === tableId);
    const waiterCall = activeWaiterCalls.find(wc => wc.table_id === tableId) ?? null;

    let status: TableLiveStatus;
    if (waiterCall)                                    status = 'needs_attention';
    else if (orders.some(o => o.status === 'ready'))   status = 'ready';
    else if (orders.length > 0)                        status = 'occupied';
    else                                               status = 'available';

    return { status, orders, waiterCall };
  }

  const statusCounts = plan.tables.reduce(
    (acc, t) => { acc[getTableStatusInfo(t.id).status]++; return acc; },
    { available: 0, occupied: 0, ready: 0, needs_attention: 0 } as Record<TableLiveStatus, number>,
  );

  // ── Quick actions ──────────────────────────────────────────────────────────
  async function markTableAvailable(tableId: string) {
    setMarkingAvailable(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('restaurant_id', restaurant.id)
        .eq('table_id', tableId)
        .in('status', ['placed', 'preparing', 'ready']);
      if (error) { toast.error('Failed to clear table'); return; }
      toast.success('Table marked as available');
      setSelectedTableId(null);
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

  // ── Save helpers ───────────────────────────────────────────────────────────
  function scheduleSave(next: FloorPlan) {
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      const supabase = createClient();
      const { error } = await supabase
        .from('restaurants')
        .update({ floor_plan: next })
        .eq('id', restaurant.id);
      if (error) {
        console.error('[FloorPlan] save error:', error);
        toast.error(`Save failed: ${error.message}`);
        setSaveStatus('unsaved');
      } else {
        setSaveStatus('saved');
      }
    }, 1000);
  }

  function updatePlan(updater: (prev: FloorPlan) => FloorPlan) {
    setPlan(prev => {
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }

  // ── Canvas click to place ──────────────────────────────────────────────────
  async function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== canvasRef.current) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x    = snap(Math.max(0, e.clientX - rect.left));
    const y    = snap(Math.max(0, e.clientY - rect.top));

    if (mode === 'addTable') {
      await placeTable(x, y);
      setMode('select');
    } else if (mode === 'addLabel') {
      placeLabel(x, y);
      setMode('select');
    }
  }

  async function placeTable(x: number, y: number) {
    setPlacingTable(true);
    try {
      const supabase = createClient();

      const existingNumbers = plan.tables.map(t => t.table_number);
      const nextNum = existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;

      const { data: created, error } = await supabase
        .from('tables')
        .insert({ restaurant_id: restaurant.id, table_number: nextNum })
        .select('id')
        .single();

      if (error || !created) {
        toast.error('Failed to create table');
        return;
      }

      const ft: FloorTable = {
        id: created.id,
        table_number: nextNum,
        x, y,
        shape: pendingShape,
        capacity: pendingCapacity,
      };

      updatePlan(prev => ({ ...prev, tables: [...prev.tables, ft] }));
    } finally {
      setPlacingTable(false);
    }
  }

  function placeLabel(x: number, y: number) {
    const fl: FloorLabel = {
      id: crypto.randomUUID(),
      text: 'Section',
      x, y,
    };
    updatePlan(prev => ({ ...prev, labels: [...prev.labels, fl] }));
  }

  // ── Drag (with tap detection) ──────────────────────────────────────────────
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

  /**
   * If the pointer didn't move (tap), fire onTap instead of saving.
   * Grid snapping means sub-10px moves resolve to the same position anyway.
   */
  function handlePointerUp(
    e: React.PointerEvent,
    id: string,
    onTap?: () => void,
  ) {
    if (draggingId !== id) return;
    setDraggingId(null);
    if (!dragMoved.current && onTap) {
      onTap();
    } else if (dragMoved.current) {
      setPlan(prev => { scheduleSave(prev); return prev; });
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  function handleContextMenu(
    e: React.MouseEvent,
    id: string,
    type: 'table' | 'label',
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, type, screenX: e.clientX, screenY: e.clientY });
  }

  function openEdit(id: string, type: 'table' | 'label') {
    if (type === 'table') {
      const t = plan.tables.find(t => t.id === id);
      if (!t) return;
      setEditForm({ id, type, table_number: t.table_number, shape: t.shape, capacity: t.capacity, text: '' });
    } else {
      const l = plan.labels.find(l => l.id === id);
      if (!l) return;
      setEditForm({ id, type, table_number: 1, shape: 'round', capacity: 4, text: l.text });
    }
  }

  function removeElement(id: string, type: 'table' | 'label') {
    updatePlan(prev => ({
      tables: type === 'table' ? prev.tables.filter(t => t.id !== id) : prev.tables,
      labels: type === 'label' ? prev.labels.filter(l => l.id !== id) : prev.labels,
    }));
  }

  // ── Edit dialog save ───────────────────────────────────────────────────────
  async function commitEdit() {
    if (!editForm) return;

    if (editForm.type === 'table') {
      const { id, table_number, shape, capacity } = editForm;
      const current = plan.tables.find(t => t.id === id);

      if (current && current.table_number !== table_number) {
        const supabase = createClient();
        const { error } = await supabase
          .from('tables')
          .update({ table_number })
          .eq('id', id);

        if (error) {
          toast.error(
            error.message.toLowerCase().includes('unique')
              ? `Table #${table_number} already exists`
              : 'Failed to update table number',
          );
          return;
        }
      }

      updatePlan(prev => ({
        ...prev,
        tables: prev.tables.map(t =>
          t.id === id ? { ...t, table_number, shape, capacity } : t,
        ),
      }));
    } else {
      const { id, text } = editForm;
      updatePlan(prev => ({
        ...prev,
        labels: prev.labels.map(l => l.id === id ? { ...l, text } : l),
      }));
    }

    setEditForm(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedTable      = selectedTableId ? plan.tables.find(t => t.id === selectedTableId) ?? null : null;
  const selectedStatusInfo = selectedTableId ? getTableStatusInfo(selectedTableId) : null;

  // ── Mobile view-only ───────────────────────────────────────────────────────
  if (isMobile) {
    const tableStatusMap = new Map(plan.tables.map(t => [t.id, getTableStatusInfo(t.id)]));
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
            onTableClick={t => setSelectedTableId(t.id)}
          />
        </div>
        <TableDetailSheet
          table={selectedTable}
          statusInfo={selectedStatusInfo}
          onClose={() => setSelectedTableId(null)}
          onMarkAvailable={markTableAvailable}
          onAcknowledge={acknowledgeWaiterCall}
          acknowledging={acknowledging}
          markingAvailable={markingAvailable}
        />
      </div>
    );
  }

  // ── Desktop editor ─────────────────────────────────────────────────────────
  const tableStatusMap = new Map(plan.tables.map(t => [t.id, getTableStatusInfo(t.id)]));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-white flex-shrink-0">
        <h1 className="text-base font-semibold mr-1">Floor Plan</h1>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          size="sm"
          variant={mode === 'addTable' ? 'default' : 'outline'}
          onClick={() => setMode(m => m === 'addTable' ? 'select' : 'addTable')}
          disabled={placingTable}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Table
        </Button>

        <Button
          size="sm"
          variant={mode === 'addLabel' ? 'default' : 'outline'}
          onClick={() => setMode(m => m === 'addLabel' ? 'select' : 'addLabel')}
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
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-700 font-medium">{statusCounts.available}</span>
          <span className="text-muted-foreground">available</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-700 font-medium">{statusCounts.occupied}</span>
          <span className="text-muted-foreground">occupied</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-blue-700 font-medium">{statusCounts.ready}</span>
          <span className="text-muted-foreground">ready</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-700 font-medium">{statusCounts.needs_attention}</span>
          <span className="text-muted-foreground">needs attention</span>
        </span>
      </div>

      {/* ── Mode config bar ── */}
      {mode === 'addTable' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 bg-blue-50 border-b flex-shrink-0">
          {/* Shape toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Shape:</span>
            {(['round', 'square'] as FloorShape[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setPendingShape(s)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  pendingShape === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
                )}
              >
                {s === 'round' ? '⭕ Round' : '⬛ Square'}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-blue-200" />

          {/* Capacity buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Seats:</span>
            {([2, 4, 6, 8] as FloorCapacity[]).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setPendingCapacity(c)}
                className={cn(
                  'w-8 h-7 text-xs rounded-md border transition-colors',
                  pendingCapacity === c
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-blue-200" />

          {/* Mini preview */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700 font-medium">Preview:</span>
            <div
              style={{
                width:  Math.round(tableSize(pendingCapacity).w * 0.35),
                height: Math.round(tableSize(pendingCapacity).h * 0.35),
                borderRadius: pendingShape === 'round' ? '50%' : 4,
                background: 'rgba(59,130,246,0.15)',
                border: '1.5px solid #3b82f6',
                flexShrink: 0,
              }}
            />
          </div>

          <span className="text-xs text-blue-600 ml-auto">
            {placingTable ? '⏳ Creating table…' : '🖱 Click on the canvas to place'}
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
              onPointerUp={e => handlePointerUp(e, label.id)}
              onContextMenu={e => handleContextMenu(e, label.id, 'label')}
            />
          ))}

          {plan.tables.map(table => {
            const { w, h } = tableSize(table.capacity);
            return (
              <TableElement
                key={table.id}
                table={table}
                statusInfo={tableStatusMap.get(table.id)}
                isDragging={draggingId === table.id}
                onPointerDown={e => handlePointerDown(e, table.id, table.x, table.y)}
                onPointerMove={e => handlePointerMove(e, table.id, w, h)}
                onPointerUp={e => handlePointerUp(e, table.id, () => setSelectedTableId(table.id))}
                onContextMenu={e => handleContextMenu(e, table.id, 'table')}
              />
            );
          })}
        </div>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 min-w-[148px] rounded-lg border bg-white py-1 shadow-lg"
            style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          >
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              onClick={() => { openEdit(ctxMenu.id, ctxMenu.type); setCtxMenu(null); }}
            >
              ✏️ Edit
            </button>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => { removeElement(ctxMenu.id, ctxMenu.type); setCtxMenu(null); }}
            >
              🗑 Remove
            </button>
          </div>
        </>
      )}

      {/* ── Edit dialog ── */}
      <Dialog open={!!editForm} onOpenChange={() => setEditForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editForm?.type === 'table'
                ? `Edit Table #${editForm.table_number}`
                : 'Edit Label'}
            </DialogTitle>
          </DialogHeader>

          {editForm?.type === 'table' ? (
            <div className="space-y-4 py-1">
              <div>
                <Label htmlFor="tnum">Table Number</Label>
                <Input
                  id="tnum"
                  type="number"
                  min={1}
                  value={editForm.table_number}
                  onChange={e =>
                    setEditForm(f => f ? { ...f, table_number: Math.max(1, parseInt(e.target.value) || 1) } : f)
                  }
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Shape</Label>
                <div className="flex gap-2 mt-1.5">
                  {(['round', 'square'] as FloorShape[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditForm(f => f ? { ...f, shape: s } : f)}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-lg border transition-colors',
                        editForm.shape === s
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      {s === 'round' ? '⭕ Round' : '⬛ Square'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Capacity</Label>
                <div className="flex gap-2 mt-1.5">
                  {([2, 4, 6, 8] as FloorCapacity[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm(f => f ? { ...f, capacity: c } : f)}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-lg border transition-colors',
                        editForm.capacity === c
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <Label htmlFor="ltext">Label Text</Label>
              <Input
                id="ltext"
                value={editForm?.text ?? ''}
                onChange={e => setEditForm(f => f ? { ...f, text: e.target.value } : f)}
                placeholder="e.g. Patio, Main Hall, Bar"
                className="mt-1.5"
                autoFocus
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)}>Cancel</Button>
            <Button onClick={commitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Table detail sheet ── */}
      <TableDetailSheet
        table={selectedTable}
        statusInfo={selectedStatusInfo}
        onClose={() => setSelectedTableId(null)}
        onMarkAvailable={markTableAvailable}
        onAcknowledge={acknowledgeWaiterCall}
        acknowledging={acknowledging}
        markingAvailable={markingAvailable}
      />
    </div>
  );
}

// ─── TableDetailSheet ─────────────────────────────────────────────────────────

interface TableDetailSheetProps {
  table: FloorTable | null;
  statusInfo: TableStatusInfo | null;
  onClose: () => void;
  onMarkAvailable: (tableId: string) => Promise<void>;
  onAcknowledge: (callId: string) => Promise<void>;
  acknowledging: boolean;
  markingAvailable: boolean;
}

function TableDetailSheet({
  table,
  statusInfo,
  onClose,
  onMarkAvailable,
  onAcknowledge,
  acknowledging,
  markingAvailable,
}: TableDetailSheetProps) {
  const open = !!table && !!statusInfo;
  if (!open) {
    return <Sheet open={false} onOpenChange={o => { if (!o) onClose(); }} />;
  }

  const colors = STATUS_COLORS[statusInfo.status];

  return (
    <Sheet open onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 overflow-hidden sm:max-w-md">
        {/* Header */}
        <SheetHeader
          className="border-b p-4 flex-shrink-0"
          style={{ borderLeftColor: colors.border, borderLeftWidth: 4 }}
        >
          <div className="flex items-center gap-3 pr-8">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: colors.bg, color: colors.text }}
            >
              #{table.table_number}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle>Table {table.table_number}</SheetTitle>
              <SheetDescription>
                {table.capacity} seats · {table.shape}
              </SheetDescription>
            </div>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              {STATUS_LABELS[statusInfo.status]}
            </span>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Waiter call banner */}
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
                {acknowledging
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : 'Acknowledge'}
              </Button>
            </div>
          )}

          {/* Orders */}
          {statusInfo.orders.length > 0 ? (
            <div>
              <p className="text-sm font-semibold mb-3">
                Active Orders ({statusInfo.orders.length})
              </p>
              <div className="space-y-3">
                {statusInfo.orders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <p className="text-sm">No active orders</p>
              <p className="text-xs mt-1">This table is available</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <SheetFooter className="border-t bg-gray-50 p-4 flex-col gap-2 flex-shrink-0">
          {statusInfo.orders.length > 0 && (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => onMarkAvailable(table.id)}
              disabled={markingAvailable}
            >
              {markingAvailable
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Clearing table…</>
                : 'Mark Available'}
            </Button>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/orders">
              View Full Orders Dashboard
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

const ORDER_STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  placed:    { bg: '#fef9c3', text: '#854d0e', border: '#fde047', label: 'Placed' },
  preparing: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Preparing' },
  ready:     { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'Ready' },
  delivered: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: 'Delivered' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Cancelled' },
};

function OrderCard({ order }: { order: Order }) {
  const st = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.placed;

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
        <span className="text-sm font-semibold text-right flex-shrink-0">
          {formatPrice(order.total)}
        </span>
      </div>

      {order.items && order.items.length > 0 && (
        <ul className="space-y-1 pt-2 border-t">
          {order.items.map(item => (
            <li key={item.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{item.quantity}× {item.name}</span>
              <span className="flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── ViewCanvas (mobile view-only) ───────────────────────────────────────────

interface ViewCanvasProps {
  plan: FloorPlan;
  tableStatusMap: Map<string, TableStatusInfo>;
  onTableClick: (table: FloorTable) => void;
}

function ViewCanvas({ plan, tableStatusMap, onTableClick }: ViewCanvasProps) {
  return (
    <div
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: 'relative',
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: `${GRID}px ${GRID}px`,
      }}
      className="bg-white"
    >
      {plan.labels.map(l => <LabelElement key={l.id} label={l} viewOnly />)}
      {plan.tables.map(t => (
        <TableElement
          key={t.id}
          table={t}
          viewOnly
          statusInfo={tableStatusMap.get(t.id)}
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
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TableElement({
  table,
  viewOnly,
  statusInfo,
  isDragging,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: TableElementProps) {
  const { w, h } = tableSize(table.capacity);
  const isRound  = table.shape === 'round';

  const status = statusInfo?.status;
  const colors = status ? STATUS_COLORS[status] : null;

  const bg     = isDragging ? '#e0e7ff' : (colors?.bg     ?? '#f0f4ff');
  const border = isDragging ? '#4f46e5' : (colors?.border ?? '#818cf8');
  const text   = isDragging ? '#3730a3' : (colors?.text   ?? '#3730a3');
  const sub    = isDragging ? '#6366f1' : (colors?.sub    ?? '#6366f1');

  const needsAttention = status === 'needs_attention' && !isDragging;

  return (
    <div
      style={{
        position: 'absolute',
        left: table.x,
        top: table.y,
        width: w,
        height: h,
        cursor: viewOnly ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 50 : 2,
      }}
      className={needsAttention ? 'animate-pulse' : undefined}
      onClick={viewOnly ? onClick : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: isRound ? '50%' : 10,
          background: bg,
          border: `2px solid ${border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDragging
            ? '0 8px 24px rgba(79,70,229,0.25)'
            : needsAttention
              ? '0 0 0 3px rgba(239,68,68,0.25)'
              : '0 2px 6px rgba(0,0,0,0.08)',
          transition: isDragging ? 'none' : 'box-shadow 0.15s, background 0.25s, border-color 0.25s',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: text, lineHeight: 1 }}>
          #{table.table_number}
        </span>
        <span style={{ fontSize: 11, color: sub, marginTop: 3 }}>
          {table.capacity}p
        </span>
      </div>
    </div>
  );
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

function LabelElement({
  label,
  viewOnly,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: LabelElementProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: label.x,
        top: label.y,
        cursor: viewOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 50 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <div
        style={{
          padding: '4px 12px',
          borderRadius: 5,
          background: isDragging ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)',
          border: '1.5px dashed #94a3b8',
          fontSize: 13,
          fontWeight: 600,
          color: '#475569',
          whiteSpace: 'nowrap',
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >
        {label.text}
      </div>
    </div>
  );
}
