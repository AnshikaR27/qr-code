'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  X, Clock, CheckCheck, PlusCircle, ChefHat, IndianRupee, ReceiptText, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { useOrders } from '@/contexts/OrdersContext';
import { hasPermission } from '@/lib/staff-permissions';
import { cn, formatPrice } from '@/lib/utils';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
import { broadcastPrintBill } from '@/lib/bill-print-broadcast';
import { buildCombinedBillData } from '@/lib/billing';
import type {
  FloorCapacity,
  FloorPlan,
  FloorTable,
  Order,
  OrderItem,
} from '@/types';

const GRID = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;

function tableLabelText(t: { table_number: number; display_name?: string | null }): string {
  return t.display_name?.trim() || `#${t.table_number}`;
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

interface SelectedTable {
  dbId: string;
  label: string;
  orders: Order[];
}

export default function StaffTablesPage() {
  const { staff, restaurant } = useStaff();
  const { orders } = useOrders();
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);

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

  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled' && !o.payment_method
  );

  function getTableStatus(tableNumber: number): { status: TableLiveStatus; orders: Order[] } {
    const tableOrders = activeOrders.filter((o) => o.table?.table_number === tableNumber);
    if (tableOrders.length === 0) return { status: 'available', orders: [] };
    const allReady = tableOrders.every((o) => o.status === 'ready');
    if (allReady) return { status: 'ready_to_bill', orders: tableOrders };
    return { status: 'occupied', orders: tableOrders };
  }

  function handleTableClick(table: FloorTable, dbId: string, info: { status: TableLiveStatus; orders: Order[] }) {
    if (info.status === 'available') return; // available tables use Link navigation
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
    } else if (JSON.stringify(freshOrders.map(o => o.id).sort()) !== JSON.stringify(selectedTable.orders.map(o => o.id).sort())) {
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
    <div className="p-4 sm:p-6 pb-20 md:pb-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-sm text-muted-foreground mt-1">Tap a table to view or place an order</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="text-muted-foreground font-medium">
          {plan.tables.length} table{plan.tables.length !== 1 ? 's' : ''}:
        </span>
        {([
          { key: 'available' as const, color: 'bg-green-500', textColor: 'text-green-700', label: 'available' },
          { key: 'occupied' as const, color: 'bg-amber-500', textColor: 'text-amber-700', label: 'occupied' },
          { key: 'ready_to_bill' as const, color: 'bg-violet-500', textColor: 'text-violet-700', label: 'ready to bill' },
        ]).map(({ key, color, textColor, label }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className={`font-medium ${textColor}`}>{statusCounts[key]}</span>
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border shadow-sm bg-white">
        <StaffFloorCanvas
          plan={plan}
          getTableStatus={getTableStatus}
          dbTableIds={dbTableIds}
          onOccupiedTableClick={handleTableClick}
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
}: {
  plan: FloorPlan;
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[] };
  dbTableIds: Map<number, string>;
  onOccupiedTableClick: (table: FloorTable, dbId: string, info: { status: TableLiveStatus; orders: Order[] }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      if (!containerRef.current) return;
      setScale(Math.min(1, containerRef.current.clientWidth / CANVAS_W));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', height: CANVAS_H * scale }}>
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: `${GRID}px ${GRID}px`,
          userSelect: 'none',
        }}
      >
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

      <MergeGroupBackgrounds tables={plan.tables} getTableStatus={getTableStatus} />

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
            onOccupiedClick={() => onOccupiedTableClick(table, dbId, info)}
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
  onOccupiedClick,
}: {
  table: FloorTable;
  status: TableLiveStatus;
  orders: Order[];
  dbId: string;
  onOccupiedClick: () => void;
}) {
  const { w, h } = tableSize(table.capacity);
  const isRound = table.shape === 'round';
  const colors = STATUS_COLORS[status];
  const customerName = tableOrders.find((o) => o.customer_name)?.customer_name ?? null;
  const inMergeGroup = !!table.merge_group_id;
  const showName = customerName && !inMergeGroup;
  const orderCount = tableOrders.length;

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
      }}
      className="hover:shadow-lg hover:scale-105"
    >
      <span style={{ fontWeight: 700, fontSize: 13, color: colors.text, lineHeight: 1 }}>
        {tableLabelText(table)}
      </span>
      {showName ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.text,
            marginTop: 3,
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
      ) : orderCount > 0 ? (
        <span style={{ fontSize: 10, fontWeight: 600, color: colors.text, marginTop: 3 }}>
          {orderCount} order{orderCount !== 1 ? 's' : ''}
        </span>
      ) : (
        <span style={{ fontSize: 11, color: colors.sub, marginTop: 3 }}>
          {table.capacity}p
        </span>
      )}
    </div>
  );

  const positionStyle = {
    position: 'absolute' as const,
    left: table.x,
    top: table.y,
    width: w,
    height: h,
    cursor: 'pointer',
    zIndex: 2,
    display: 'block',
    textDecoration: 'none',
  };

  if (status === 'available') {
    return (
      <Link href={`/staff-dashboard/tables/${dbId}/new-order`} style={positionStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOccupiedClick} style={positionStyle}>
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

  async function handleMarkReady(order: Order) {
    setUpdating(order.id);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update status');
      }
      toast.success(`Order #${order.order_number} marked ready`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  }

  async function handlePrintBill() {
    const config = restaurant.billing_config;
    const printerConf = restaurant.printer_config;
    if (!config?.gstin && !config?.legal_name) {
      toast.error('Set up Tax & Billing in Settings first');
      return;
    }
    const orderData = buildCombinedBillData(table.orders);
    const billPrinterId = printerConf?.bill_printer;
    const billPrinter = billPrinterId ? printerConf?.printers.find(p => p.id === billPrinterId) : null;
    if (billPrinter && billPrinter.type !== 'browser') {
      try {
        await broadcastPrintBill(restaurant.id, orderData);
        toast.success('Bill sent to printer');
        return;
      } catch { /* fall through to browser */ }
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
      toast.success('Payment collected');
      const billedOrders = orderIds.map(id => table.orders.find(o => o.id === id)).filter(Boolean) as Order[];
      if (billedOrders.length > 0) {
        const printerConf = restaurant.printer_config;
        const billPrinterId = printerConf?.bill_printer;
        const billPrinter = billPrinterId ? printerConf?.printers.find(p => p.id === billPrinterId) : null;
        if (billPrinter && billPrinter.type !== 'browser') {
          broadcastPrintBill(restaurant.id, buildCombinedBillData(billedOrders)).catch(() => {});
        } else {
          try {
            const config = restaurant.billing_config;
            if (config) {
              const { printCustomerBill } = await import('@/lib/billing');
              printCustomerBill(buildCombinedBillData(billedOrders), restaurant, config);
            }
          } catch { /* silent */ }
        }
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
                {table.orders.length} order{table.orders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {formatPrice(totalAmount)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrintBill}
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

          {/* Order cards */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {table.orders.map((order) => (
              <ModalOrderCard
                key={order.id}
                order={order}
                onMarkReady={() => handleMarkReady(order)}
                onCollect={() => setBillingOrders([order])}
                isUpdating={updating === order.id}
              />
            ))}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t space-y-2">
            {table.orders.every(o => o.status === 'ready') && (
              <button
                onClick={() => setBillingOrders(table.orders)}
                disabled={!!updating}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <IndianRupee className="w-5 h-5" />
                Collect Payment
              </button>
            )}
            <button
              onClick={() => { onClose(); router.push(`/staff-dashboard/tables/${table.dbId}/new-order`); }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Add items to this table
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

function ModalOrderCard({
  order,
  onMarkReady,
  onCollect,
  isUpdating,
}: {
  order: Order;
  onMarkReady: () => void;
  onCollect: () => void;
  isUpdating: boolean;
}) {
  const activeItems = (order.items ?? []).filter((i) => i.status !== 'voided');
  const isReady = order.status === 'ready';

  return (
    <div className={cn(
      'rounded-xl border-2 overflow-hidden',
      isReady ? 'border-green-300' : 'border-amber-200',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5',
        isReady ? 'bg-green-50' : 'bg-amber-50',
      )}>
        <div className="flex items-center gap-2">
          <span className="font-bold">#{order.order_number}</span>
          {order.customer_name && (
            <span className="text-xs text-muted-foreground">· {order.customer_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            isReady ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800',
          )}>
            {isReady ? (
              <span className="flex items-center gap-0.5"><CheckCheck className="w-3 h-3" /> READY</span>
            ) : 'PREPARING'}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-2.5 space-y-1.5">
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

      {/* Footer with action */}
      <div className="px-4 py-2.5 border-t bg-gray-50 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''}</span>
          <span className="font-bold text-sm">{formatPrice(order.total)}</span>
        </div>
        {order.status === 'placed' && (
          <button
            onClick={onMarkReady}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChefHat className="w-3 h-3" />}
            Mark Ready
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={onCollect}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <IndianRupee className="w-3 h-3" />}
            Collect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Merge Group Backgrounds ────────────────────────────────────────────────

function MergeGroupBackgrounds({
  tables,
  getTableStatus,
}: {
  tables: FloorTable[];
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[] };
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
