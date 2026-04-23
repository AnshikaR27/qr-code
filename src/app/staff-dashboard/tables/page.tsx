'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { useOrders } from '@/contexts/OrdersContext';
import type {
  FloorCapacity,
  FloorPlan,
  FloorTable,
  Order,
} from '@/types';

const GRID = 20;
const CANVAS_W = 1400;
const CANVAS_H = 900;

function tableLabel(t: { table_number: number; display_name?: string | null }): string {
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

type TableLiveStatus = 'available' | 'occupied' | 'needs_attention';

const STATUS_COLORS: Record<TableLiveStatus, { bg: string; border: string; text: string; sub: string }> = {
  available:       { bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', text: '#15803d', sub: '#16a34a' },
  occupied:        { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#b45309', sub: '#d97706' },
  needs_attention: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#b91c1c', sub: '#dc2626' },
};

export default function StaffTablesPage() {
  const { restaurant } = useStaff();
  const { orders } = useOrders();
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
    return { status: 'occupied', orders: tableOrders };
  }

  if (plan.tables.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Tables</h1>
          <p className="text-sm text-muted-foreground mt-1">Tap a table to place an order</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No tables found. Ask the owner to set up tables in the floor plan.
        </div>
      </div>
    );
  }

  const statusCounts = plan.tables.reduce(
    (acc, t) => { acc[getTableStatus(t.table_number).status]++; return acc; },
    { available: 0, occupied: 0, needs_attention: 0 } as Record<TableLiveStatus, number>,
  );

  return (
    <div className="p-4 sm:p-6 pb-20 md:pb-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-sm text-muted-foreground mt-1">Tap a table to place an order</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="text-muted-foreground font-medium">
          {plan.tables.length} table{plan.tables.length !== 1 ? 's' : ''}:
        </span>
        {([
          { key: 'available' as const, color: 'bg-green-500', textColor: 'text-green-700', label: 'available' },
          { key: 'occupied' as const, color: 'bg-amber-500', textColor: 'text-amber-700', label: 'occupied' },
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
        />
      </div>
    </div>
  );
}

function StaffFloorCanvas({
  plan,
  getTableStatus,
  dbTableIds,
}: {
  plan: FloorPlan;
  getTableStatus: (tableNumber: number) => { status: TableLiveStatus; orders: Order[] };
  dbTableIds: Map<number, string>;
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
        return (
          <StaffTableElement
            key={table.id}
            table={table}
            status={info.status}
            orders={info.orders}
            dbId={dbTableIds.get(table.table_number) ?? table.id}
          />
        );
      })}
      </div>
    </div>
  );
}

function StaffTableElement({
  table,
  status,
  orders: tableOrders,
  dbId,
}: {
  table: FloorTable;
  status: TableLiveStatus;
  orders: Order[];
  dbId: string;
}) {
  const { w, h } = tableSize(table.capacity);
  const isRound = table.shape === 'round';
  const colors = STATUS_COLORS[status];
  const customerName = tableOrders.find((o) => o.customer_name)?.customer_name ?? null;
  const inMergeGroup = !!table.merge_group_id;
  const showName = customerName && !inMergeGroup;
  const orderCount = tableOrders.length;

  return (
    <Link
      href={`/staff-dashboard/tables/${dbId}/new-order`}
      style={{
        position: 'absolute',
        left: table.x,
        top: table.y,
        width: w,
        height: h,
        cursor: 'pointer',
        zIndex: 2,
        display: 'block',
        textDecoration: 'none',
      }}
    >
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
          {tableLabel(table)}
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
    </Link>
  );
}

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
