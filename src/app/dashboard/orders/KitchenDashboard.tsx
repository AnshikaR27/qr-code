'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  BellRing, ChefHat, CheckCheck, IndianRupee, XCircle, Printer, ReceiptText,
  Usb, AlertTriangle, GitMerge, Unlink2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import { useOrders } from '@/contexts/OrdersContext';
import PrintOrderDialog from '@/components/dashboard/PrintOrderDialog';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
import type { Order, OrderStatus, Restaurant, PrinterDevice } from '@/types';

interface Props {
  restaurant: Restaurant;
  initialOrders: Order[];
}

type FilterTab = 'active' | 'all' | 'completed';

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  placed:    'ready',
  preparing: null,
  ready:     'delivered',
  delivered: null,
  cancelled: null,
};

function getStatusLabels(serviceMode: 'self_service' | 'table_service'): Record<OrderStatus, string> {
  return {
    placed:    serviceMode === 'table_service' ? 'Send to Table' : 'Food Ready',
    preparing: 'Preparing',
    ready:     'Record Payment',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
}

export default function KitchenDashboard({ restaurant }: Props) {
  const { orders } = useOrders();
  const [filter, setFilter]     = useState<FilterTab>('active');
  const [updating, setUpdating] = useState<string | null>(null);

  // Print dialog state
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printMode, setPrintMode]   = useState<'accept' | 'reprint'>('accept');

  // Payment / billing state
  const [paymentOrder, setPaymentOrder]     = useState<Order | null>(null);
  const [billingOrders, setBillingOrders]   = useState<Order[] | null>(null);

  // All-time orders for the "Completed" tab (lazy-loaded)
  const [allTimeOrders, setAllTimeOrders]     = useState<Order[] | null>(null);
  const [loadingAllTime, setLoadingAllTime]   = useState(false);

  const fetchAllTimeOrders = useCallback(async () => {
    if (allTimeOrders !== null) return;          // already loaded
    setLoadingAllTime(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*), table:tables(*)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });
    if (data) setAllTimeOrders(data as Order[]);
    setLoadingAllTime(false);
  }, [restaurant.id, allTimeOrders]);

  // Drag-to-merge state (pointer-events based, no library)
  const [draggingOrderId, setDraggingOrderId]     = useState<string | null>(null);
  const [dropTargetOrderId, setDropTargetOrderId] = useState<string | null>(null);

  // USB printer connection state
  const [disconnectedUSB, setDisconnectedUSB] = useState<PrinterDevice[]>([]);
  const [connectingUSB, setConnectingUSB]     = useState<string | null>(null);

  // Always holds the latest restaurant prop so async closures never read stale data
  const restaurantRef = useRef(restaurant);
  restaurantRef.current = restaurant;

  // ── Auto-reconnect USB printers on mount ───────────────────────────────────
  useEffect(() => {
    const config = restaurant.printer_config;
    if (!config) return;
    const connectablePrinters = config.printers.filter((p) => p.type === 'usb' || p.type === 'serial');
    if (connectablePrinters.length === 0) return;

    import('@/lib/printer-service').then(async ({ printerService }) => {
      const results = await printerService.reconnectAll(config);
      const failed = connectablePrinters.filter((p) => results.get(p.id) !== true);
      setDisconnectedUSB(failed);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectUSBPrinter(printer: PrinterDevice) {
    setConnectingUSB(printer.id);
    try {
      const { printerService } = await import('@/lib/printer-service');
      const result = printer.type === 'serial'
        ? await printerService.connectSerial(printer.id)
        : await printerService.connectUSB(printer.id);
      if (result.success) {
        setDisconnectedUSB((prev) => prev.filter((p) => p.id !== printer.id));
        toast.success(`${printer.name} connected`);
      } else if (result.error && result.error !== 'No device selected') {
        toast.error(result.error);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnectingUSB(null);
    }
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  async function advanceStatus(order: Order) {
    if (order.status === 'ready') {
      setPaymentOrder(order);
      return;
    }
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;
    setUpdating(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', order.id);
      if (error) throw error;
      if (nextStatus === 'ready') {
        sendReadyPush(order).catch(() => {});
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setUpdating(null);
    }
  }

  async function sendReadyPush(order: Order) {
    const isTableService = restaurant.service_mode === 'table_service';
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          title: isTableService ? 'Your food is on its way! 🍽️' : 'Your order is ready! 🔔',
          body: isTableService
            ? `Order #${order.order_number} — your food is being brought to your table.`
            : `Order #${order.order_number} at ${restaurant.name} — please collect from the counter`,
          url: `/${restaurant.slug}/order/${order.id}`,
        }),
      });
    } catch (err) {
      console.warn('[push] failed to send ready notification:', err);
    }
  }

  async function handleBillingConfirm(orderIds: string[], data: BillingConfirmData) {
    setPaymentOrder(null);
    setBillingOrders(null);
    setUpdating(orderIds[0]);
    try {
      const supabase = createClient();

      // Check whether these orders belong to a merge group (so we can dissolve it)
      const isMergedBilling = orderIds.some(id => orders.find(o => o.id === id)?.merge_group_id);

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
            merge_group_id: null,   // dissolve merge on payment
          })
          .eq('id', id);
        if (error) throw error;
      }

      // If these were a merged billing group, also clear the tables so the
      // floor plan purple outline disappears (FloorPlanEditor picks this up
      // via its Realtime listener on the tables table).
      if (isMergedBilling) {
        const tableIds = Array.from(new Set(
          orderIds.map(id => orders.find(o => o.id === id)?.table_id).filter(Boolean) as string[],
        ));
        if (tableIds.length > 0) {
          await supabase
            .from('tables')
            .update({ merge_group_id: null, merged_with: null })
            .in('id', tableIds);
        }
        toast.success('Payment recorded · tables unmerged');
      } else {
        toast.success(`Payment recorded — ${data.payment_method.toUpperCase()}`);
      }

      // Clean up push subscriptions for delivered orders
      for (const id of orderIds) {
        supabase.from('push_subscriptions').delete().eq('order_id', id).then(() => {});
      }

      // Auto-print bill for single-order billing only
      if (!isMergedBilling) {
        const order = orders.find(o => o.id === orderIds[0]);
        if (order) {
          try { await handlePrintBill(order); } catch { /* silent */ }
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setUpdating(null);
    }
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`Cancel order #${order.order_number}?`)) return;
    setUpdating(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);
      if (error) throw error;
      supabase.from('push_subscriptions').delete().eq('order_id', order.id).then(() => {});
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setUpdating(null);
    }
  }

  // ── Print dialog handlers ──────────────────────────────────────────────────

  function openAcceptDialog(order: Order) {
    setPrintMode('accept');
    setPrintOrder(order);
  }

  function openReprintDialog(order: Order) {
    setPrintMode('reprint');
    setPrintOrder(order);
  }

  async function handlePrintConfirm(order: Order) {
    setPrintOrder(null);
    if (printMode === 'accept') {
      await advanceStatus(order);
    }
  }

  async function handlePrintBill(order: Order) {
    const config = restaurant.billing_config;
    const printerConf = restaurant.printer_config;

    if (!config?.gstin && !config?.legal_name) {
      toast.error('Set up Tax & Billing in Settings first');
      return;
    }

    const { buildBillReceipt } = await import('@/lib/escpos-bill');

    if (printerConf && printerConf.bill_printer) {
      const printer = printerConf.printers.find((p) => p.id === printerConf.bill_printer);
      if (printer && printer.type !== 'browser') {
        const { printerService } = await import('@/lib/printer-service');
        const copies = printerConf.copies_bill ?? 1;
        const data = buildBillReceipt(order, restaurant.name, restaurant.phone ?? null, config!, printer.paper_width, false);
        const result = await printerService.print(printer, data);
        if (result.success) {
          if (copies === 2) {
            const dup = buildBillReceipt(order, restaurant.name, restaurant.phone ?? null, config!, printer.paper_width, true);
            await printerService.print(printer, dup);
          }
          toast.success('Bill printed');
          return;
        }
        if (result.error !== 'Use browser fallback') {
          toast.error(result.error ?? 'Print failed');
          return;
        }
      }
    }

    const { printCustomerBill } = await import('@/lib/billing');
    printCustomerBill(order, restaurant, config!);
  }

  // ── Drag-to-merge ─────────────────────────────────────────────────────────

  async function mergeTwoOrders(sourceId: string, targetId: string) {
    const sourceOrder = orders.find(o => o.id === sourceId);
    const targetOrder = orders.find(o => o.id === targetId);
    if (!sourceOrder || !targetOrder) return;

    // Validate: both must be active and unpaid
    const bothEligible = [sourceOrder, targetOrder].every(
      o => (o.status === 'placed' || o.status === 'ready') && !o.payment_method,
    );
    if (!bothEligible) {
      toast.error('Cannot merge — both orders must be active and unpaid');
      return;
    }

    // Reuse an existing merge group UUID if either order is already in one,
    // so dragging a third card onto a merged group just extends it.
    const existingGroupId = sourceOrder.merge_group_id || targetOrder.merge_group_id;
    const groupId = existingGroupId ?? crypto.randomUUID();

    const supabase = createClient();
    const idsToUpdate = existingGroupId
      ? [sourceId, targetId]
      : [sourceId, targetId];

    const { error } = await supabase
      .from('orders')
      .update({ merge_group_id: groupId })
      .in('id', idsToUpdate);
    if (error) {
      console.error('[mergeTwoOrders] supabase error:', error);
      toast.error(error.message ?? 'Failed to merge orders');
      return;
    }

    // Sync to tables so the floor plan purple outline appears.
    // When extending an existing group, include ALL tables in the group.
    const allGroupOrders = existingGroupId
      ? orders.filter(o => o.merge_group_id === existingGroupId)
      : [];
    const tableIds = Array.from(new Set(
      [...allGroupOrders, sourceOrder, targetOrder].filter(o => o.table_id).map(o => o.table_id!),
    ));
    if (tableIds.length > 0) {
      await supabase.from('tables').update({ merge_group_id: groupId, merged_with: tableIds }).in('id', tableIds);
    }

    toast.success('Orders merged', {
      action: { label: 'Undo', onClick: () => unmergeGroup(groupId) },
      duration: 5000,
    });
  }

  async function unmergeGroup(mergeGroupId: string) {
    const grouped = orders.filter(o => o.merge_group_id === mergeGroupId);
    const supabase = createClient();

    const { error } = await supabase
      .from('orders')
      .update({ merge_group_id: null })
      .in('id', grouped.map(o => o.id));
    if (error) { toast.error('Failed to split orders'); return; }

    const tableIds = Array.from(new Set(grouped.filter(o => o.table_id).map(o => o.table_id!)));
    if (tableIds.length > 0) {
      await supabase
        .from('tables')
        .update({ merge_group_id: null, merged_with: null })
        .in('id', tableIds);
    }

    toast.success('Orders split');
  }

  // ── Filtering & grouping ───────────────────────────────────────────────────

  const filtered = (() => {
    if (filter === 'active') return orders.filter(o => o.status === 'placed' || o.status === 'ready');
    if (filter === 'all')    return orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');
    // 'completed' — every order ever (all-time), fall back to today's while loading
    return (allTimeOrders ?? orders);
  })();

  // Group merged orders into combined display items; singles stay individual.
  type DisplayItem =
    | { type: 'single'; order: Order }
    | { type: 'merged'; groupId: string; groupOrders: Order[] };

  const displayItems = useMemo<DisplayItem[]>(() => {
    const seenGroups = new Set<string>();
    const items: DisplayItem[] = [];
    for (const order of filtered) {
      if (order.merge_group_id) {
        if (!seenGroups.has(order.merge_group_id)) {
          seenGroups.add(order.merge_group_id);
          items.push({
            type: 'merged',
            groupId: order.merge_group_id,
            groupOrders: filtered.filter(o => o.merge_group_id === order.merge_group_id),
          });
        }
      } else {
        items.push({ type: 'single', order });
      }
    }
    return items;
  }, [filtered]);

  const activeCount = orders.filter((o) => o.status === 'placed').length;

  function changeFilter(f: FilterTab) {
    setFilter(f);
    if (f === 'completed') fetchAllTimeOrders();
  }

  return (
    <div className="p-6 pb-24 max-w-5xl mx-auto space-y-3">
      {/* ── Auto-print info banner ── */}
      {restaurant.printer_config?.kot_print_trigger === 'on_order' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <Printer className="w-4 h-4 flex-shrink-0 text-green-600" />
          <span>Auto-print is <span className="font-semibold">ON</span> — orders are accepted and printed automatically</span>
        </div>
      )}

      {/* ── USB printer disconnected banner ── */}
      {disconnectedUSB.map((printer) => (
        <div key={printer.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span><span className="font-semibold">{printer.name}</span> not connected — KOT prints will fail</span>
          </div>
          <button
            onClick={() => connectUSBPrinter(printer)}
            disabled={connectingUSB === printer.id}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            <Usb className="w-3.5 h-3.5" />
            {connectingUSB === printer.id ? 'Connecting…' : 'Connect USB'}
          </button>
        </div>
      ))}

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-6 h-6" /> Kitchen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today&apos;s orders · {orders.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <BellRing className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700">{activeCount} active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {([
          { key: 'active',    label: 'Active' },
          { key: 'all',       label: 'All' },
          { key: 'completed', label: 'Completed' },
        ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => changeFilter(key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
            {key === 'active' && activeCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Drag-to-merge instruction overlay ── */}
      {draggingOrderId && (
        <div className="fixed top-4 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-gray-900/90 text-white text-sm font-medium px-4 py-2 rounded-full shadow-xl backdrop-blur-sm">
            Drop on another order to merge
          </div>
        </div>
      )}

      {/* ── Orders grid ── */}
      {filter === 'completed' && loadingAllTime ? (
        <div className="text-center py-20 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20 animate-pulse" />
          <p className="font-medium">Loading all orders…</p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">
            {filter === 'active' ? 'No active orders' : filter === 'all' ? 'No completed orders today' : 'No orders found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayItems.map((item) =>
            item.type === 'single' ? (
              <OrderCard
                key={item.order.id}
                order={item.order}
                restaurant={restaurant}
                allOrders={orders}
                onAdvance={() => advanceStatus(item.order)}
                onCancel={() => cancelOrder(item.order)}
                onReprint={() => openReprintDialog(item.order)}
                onPrintBill={() => handlePrintBill(item.order)}
                isUpdating={updating === item.order.id}
                draggingOrderId={draggingOrderId}
                dropTargetOrderId={dropTargetOrderId}
                onDragStart={(id) => { setDraggingOrderId(id); setDropTargetOrderId(null); }}
                onDragOver={setDropTargetOrderId}
                onDragDrop={(srcId, tgtId) => {
                  setDraggingOrderId(null);
                  setDropTargetOrderId(null);
                  mergeTwoOrders(srcId, tgtId);
                }}
                onDragCancel={() => { setDraggingOrderId(null); setDropTargetOrderId(null); }}
              />
            ) : (
              <MergedOrderCard
                key={item.groupId}
                orders={item.groupOrders}
                restaurant={restaurant}
                isUpdating={item.groupOrders.some(o => updating === o.id)}
                onAdvanceOrder={advanceStatus}
                updatingId={updating}
                onBill={() => setBillingOrders(item.groupOrders)}
                onUnmerge={() => unmergeGroup(item.groupId)}
              />
            ),
          )}
        </div>
      )}

      {/* ── Print dialog ── */}
      <PrintOrderDialog
        order={printOrder}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        mode={printMode}
        onConfirm={handlePrintConfirm}
        onClose={() => setPrintOrder(null)}
        printerConfig={restaurant.printer_config}
      />

      {/* ── Billing sheet — handles both single-order and merged-group billing ── */}
      <BillingSheet
        orders={billingOrders ?? (paymentOrder ? [paymentOrder] : null)}
        restaurant={restaurant}
        onConfirm={handleBillingConfirm}
        onClose={() => { setBillingOrders(null); setPaymentOrder(null); }}
      />
    </div>
  );
}

// ── MergedOrderCard ───────────────────────────────────────────────────────────

interface MergedOrderCardProps {
  orders: Order[];
  restaurant: Restaurant;
  isUpdating: boolean;
  updatingId: string | null;
  onAdvanceOrder: (order: Order) => void;
  onBill: () => void;
  onUnmerge: () => void;
}

function MergedOrderCard({
  orders, restaurant, isUpdating, updatingId, onAdvanceOrder, onBill, onUnmerge,
}: MergedOrderCardProps) {
  const STATUS_LABELS = getStatusLabels(restaurant.service_mode ?? 'self_service');
  const tableLabels = orders
    .map(o => o.table?.display_name?.trim() || String(o.table?.table_number ?? '?'))
    .join(' + ');
  const totalItems  = orders.reduce((n, o) => n + (o.items?.length ?? 0), 0);
  const totalAmount = orders.reduce((n, o) => n + o.total, 0);
  const allReady    = orders.every(o => o.status === 'ready');

  return (
    <div className="bg-white rounded-xl border-2 border-violet-300 shadow-sm flex flex-col overflow-hidden">
      {/* ── Merged header ── */}
      <div className="px-4 py-3 border-b bg-violet-50 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <GitMerge className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="font-semibold text-violet-800 text-sm">
              Tables {tableLabels}
            </span>
          </div>
          <p className="text-xs text-violet-600 mt-0.5">
            {orders.length} orders · {totalItems} items · {formatPrice(totalAmount)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            allReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
          )}>
            {allReady ? 'Ready' : 'Active'}
          </span>
          <button
            onClick={onUnmerge}
            className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors"
            title="Split into individual orders"
          >
            <Unlink2 className="w-3.5 h-3.5" />
            Split
          </button>
        </div>
      </div>

      {/* ── Items grouped by order / table ── */}
      <div className="flex-1 divide-y overflow-y-auto" style={{ maxHeight: 280 }}>
        {orders.map((order) => (
          <div key={order.id} className="px-4 py-3">
            {/* Per-order sub-header */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">
                Table {order.table?.display_name?.trim() || order.table?.table_number} · #{order.order_number}{order.customer_name ? ` · ${order.customer_name}` : ''}
              </p>
              {order.status === 'placed' && (
                <button
                  onClick={() => onAdvanceOrder(order)}
                  disabled={updatingId === order.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  {STATUS_LABELS.placed}
                </button>
              )}
              {order.status === 'ready' && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  Ready
                </span>
              )}
            </div>
            {/* Items */}
            <div className="space-y-1">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-semibold">{item.quantity}×</span> {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Combined payment footer ── */}
      <div className="px-4 pb-4 pt-3 border-t">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">Combined total</span>
          <span className="font-bold text-base">{formatPrice(totalAmount)}</span>
        </div>
        <button
          onClick={onBill}
          disabled={isUpdating}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <IndianRupee className="w-4 h-4" />
          Record Payment
        </button>
      </div>
    </div>
  );
}

// ── OrderCard ──────────────────────────────────────────────────────────────────

/** Build a merged table label like "Table 1 + Table 3" for orders in a merge group. */
function mergedTableLabel(order: Order, allOrders: Order[]): string {
  const table = order.table;
  if (!table) return '🪑 Dine In';
  const singleLabel = `🪑 Table ${table.display_name?.trim() || table.table_number}`;
  if (!table.merge_group_id) return singleLabel;

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const o of allOrders) {
    if (!o.table || o.table.merge_group_id !== table.merge_group_id) continue;
    const key = o.table.id;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(o.table.display_name?.trim() || String(o.table.table_number));
  }
  if (!seen.has(table.id)) {
    labels.push(table.display_name?.trim() || String(table.table_number));
  }
  return labels.length > 1 ? `🔗 Table ${labels.join(' + ')}` : singleLabel;
}

interface OrderCardProps {
  order: Order;
  restaurant: Restaurant;
  allOrders: Order[];
  onAdvance: () => void;
  onCancel: () => void;
  onReprint: () => void;
  onPrintBill: () => void;
  isUpdating: boolean;
  // Drag-to-merge
  draggingOrderId: string | null;
  dropTargetOrderId: string | null;
  onDragStart: (orderId: string) => void;
  onDragOver: (targetOrderId: string | null) => void;
  onDragDrop: (sourceId: string, targetId: string) => void;
  onDragCancel: () => void;
}

function OrderCard({
  order, restaurant, allOrders, onAdvance, onCancel, onReprint, onPrintBill,
  isUpdating,
  draggingOrderId, dropTargetOrderId, onDragStart, onDragOver, onDragDrop, onDragCancel,
}: OrderCardProps) {
  const statusMeta  = ORDER_STATUSES.find((s) => s.value === order.status);
  const STATUS_LABELS = getStatusLabels(restaurant.service_mode ?? 'self_service');
  const isTerminal  = order.status === 'delivered' || order.status === 'cancelled';

  // Drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const cardRef         = useRef<HTMLDivElement>(null);

  const isDragging   = draggingOrderId === order.id;
  const isDropTarget = dropTargetOrderId === order.id;
  // Only unmerged, active, unpaid orders may be dragged (merged groups have their own card)
  const canDrag = !isTerminal && !order.merge_group_id && !order.payment_method;

  function handlePointerDown(e: React.PointerEvent) {
    if (!canDrag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    // Start drag after 300 ms hold without significant movement
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      cardRef.current?.setPointerCapture(e.pointerId);
      setDragOffset({ x: 0, y: 0 });
      onDragStart(order.id);
    }, 300);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const dx = e.clientX - pointerStartPos.current.x;
    const dy = e.clientY - pointerStartPos.current.y;

    // Cancel long-press if the finger moved before threshold
    if (longPressTimer.current && Math.hypot(dx, dy) > 8) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!isDragging) return;
    setDragOffset({ x: dx, y: dy });

    // Find the card under the pointer by temporarily making the dragged card
    // non-interactive so elementFromPoint can see through it.
    const card = cardRef.current;
    if (card) {
      card.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      card.style.pointerEvents = '';
      const targetEl = el?.closest('[data-order-id]') as HTMLElement | null;
      const targetId = targetEl?.dataset.orderId ?? null;
      onDragOver(targetId && targetId !== order.id ? targetId : null);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging) return;

    const card = cardRef.current;
    let targetId: string | null = null;
    if (card) {
      card.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      card.style.pointerEvents = '';
      const targetEl = el?.closest('[data-order-id]') as HTMLElement | null;
      targetId = targetEl?.dataset.orderId ?? null;
    }

    setDragOffset({ x: 0, y: 0 });
    if (targetId && targetId !== order.id) {
      onDragDrop(order.id, targetId);
    } else {
      onDragCancel();
    }
  }

  function handlePointerCancel() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (isDragging) onDragCancel();
    setDragOffset({ x: 0, y: 0 });
  }

  return (
    <div
      ref={cardRef}
      data-order-id={order.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        // Lift the card while dragging; scale target slightly on hover
        transform: isDragging
          ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.04) rotate(2deg)`
          : isDropTarget ? 'scale(1.02)' : undefined,
        // Smooth snap-back when drag ends; no transition during active drag
        transition: isDragging
          ? 'box-shadow 0.15s'
          : 'transform 0.25s ease, box-shadow 0.25s ease',
        boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.22)' : undefined,
        zIndex:     isDragging ? 50 : undefined,
        // Prevent browser from intercepting touch events as scroll
        touchAction: canDrag ? 'none' : undefined,
        cursor: isDragging ? 'grabbing' : (canDrag ? 'grab' : 'default'),
        willChange: isDragging ? 'transform' : undefined,
      }}
      className={cn(
        'bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden relative',
        order.status === 'placed'    && 'border-amber-300',
        order.status === 'ready'     && 'border-green-400',
        order.status === 'delivered' && 'border-gray-200 opacity-70',
        order.status === 'cancelled' && 'border-red-200 opacity-60',
        // Drop target: dashed violet outline
        isDropTarget && 'outline outline-2 outline-dashed outline-violet-500 outline-offset-2',
      )}
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="font-bold text-lg">#{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <button
              onClick={onReprint}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
              title="Reprint KOT"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={onPrintBill}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
              title="Print Customer Bill"
            >
              <ReceiptText className="w-4 h-4" />
            </button>
          )}
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', statusMeta?.color)}>
            {statusMeta?.label}
          </span>
          <span className="text-sm font-bold">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* ── Table / customer row ── */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {order.order_type === 'dine_in'
              ? `${mergedTableLabel(order, allOrders)}${order.customer_name ? ` · ${order.customer_name}` : ''}`
              : `🛍️ Parcel${order.customer_name ? ` — ${order.customer_name}` : ''}`}
          </p>
          {order.payment_method && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
              {order.payment_method.toUpperCase()}
            </span>
          )}
        </div>
        {order.customer_phone && (
          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
        )}
      </div>

      {/* ── Items ── */}
      <div className="flex-1 px-4 py-3 space-y-1.5">
        {(order.items ?? []).map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm">
                <span className="font-semibold">{item.quantity}×</span> {item.name}
              </span>
              {item.notes && (
                <p className="text-xs text-muted-foreground italic">&ldquo;{item.notes}&rdquo;</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatPrice(item.price * item.quantity)}
            </span>
          </div>
        ))}
        {order.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2 mt-2 italic">
            Note: {order.notes}
          </p>
        )}
      </div>

      {/* ── Action buttons ── */}
      {!isTerminal && (
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button
            onClick={onAdvance}
            disabled={isUpdating}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50',
              order.status === 'placed' && 'bg-green-500 hover:bg-green-600',
              order.status === 'ready'  && 'bg-indigo-600 hover:bg-indigo-700',
            )}
          >
            {isUpdating ? '…' : (
              <span className="flex items-center justify-center gap-1.5">
                {order.status === 'placed' && <CheckCheck className="w-4 h-4" />}
                {order.status === 'ready'  && <IndianRupee className="w-4 h-4" />}
                {STATUS_LABELS[order.status]}
              </span>
            )}
          </button>
          {order.status === 'placed' && (
            <button
              onClick={onCancel}
              disabled={isUpdating}
              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              title="Cancel order"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
