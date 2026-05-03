'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { IndianRupee, Clock, ChevronDown, ChevronUp, ShoppingBag, AlertTriangle, Usb, Search, X, XCircle, ChefHat, UtensilsCrossed, Merge, Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrders } from '@/contexts/OrdersContext';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import { hasPermission } from '@/lib/staff-permissions';
import { createClient } from '@/lib/supabase/client';
import { broadcastPrintBill } from '@/lib/bill-print-broadcast';
import { buildCombinedBillData } from '@/lib/billing';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
import VoidItemDialog from '@/components/dashboard/VoidItemDialog';
import CompletedOrderModal from '@/components/dashboard/CompletedOrderModal';
import ItemAvailabilityModal from '@/components/dashboard/ItemAvailabilityModal';
import type { Order, OrderItem, PrinterDevice } from '@/types';

interface TableGroup {
  key: string;
  tableLabel: string;
  orders: Order[];
  customerNames: string[];
  total: number;
  oldestReadyAt: number;
  items: OrderItem[];
  isTable: boolean;
  orderNumbers: number[];
  readyToBill: boolean;
}

type CounterFilter = 'active' | 'completed';

export default function CounterDashboard() {
  const { orders, refreshOrders } = useOrders();
  const { staff, restaurant } = useStaff();
  const [billingOrders, setBillingOrders] = useState<Order[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [disconnectedUSB, setDisconnectedUSB] = useState<PrinterDevice[]>([]);
  const [connectingUSB, setConnectingUSB] = useState<string | null>(null);
  const [show86List, setShow86List] = useState(false);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [filter, setFilter] = useState<CounterFilter>('active');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidOrderId, setVoidOrderId] = useState<string>('');
  const [voidItem, setVoidItem] = useState<OrderItem | null>(null);
  const can86 = hasPermission(staff.role, 'menu:mark_out_of_stock');
  const canMerge = hasPermission(staff.role, 'order:merge');

  // Drag-to-merge state
  const [draggingGroupKey, setDraggingGroupKey] = useState<string | null>(null);
  const [dropTargetGroupKey, setDropTargetGroupKey] = useState<string | null>(null);

  // Search-merge dialog
  const [mergeSearchGroup, setMergeSearchGroup] = useState<TableGroup | null>(null);

  useEffect(() => {
    const config = restaurant.printer_config;
    if (!config) return;
    const connectable = config.printers.filter(p => p.type === 'usb' || p.type === 'serial');
    if (connectable.length === 0) return;
    import('@/lib/printer-service').then(async ({ printerService }) => {
      const results = await printerService.reconnectAll(config);
      const failed = connectable.filter(p => results.get(p.id) !== true);
      setDisconnectedUSB(failed);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!can86) return;
    const supabase = createClient();
    const fetchCount = async () => {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', false);
      setUnavailableCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel('counter-product-avail')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchCount(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [can86, restaurant.id]);

  const activeOrders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    return orders.filter(
      o => (o.status === 'placed' || o.status === 'ready' || o.status === 'delivered') &&
        !o.payment_method &&
        new Date(o.created_at).getTime() >= todayMs,
    );
  }, [orders]);

  const completedOrders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    return orders.filter(
      o => (!!o.payment_method || o.status === 'cancelled') &&
        new Date(o.created_at).getTime() >= todayMs,
    ).sort((a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
    );
  }, [orders]);

  // Re-render every minute to keep "X min" labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (activeOrders.length === 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [activeOrders.length]);

  // Group by merge_group_id > table_id > individual (no-table)
  const tableGroups = useMemo<TableGroup[]>(() => {
    const groups = new Map<string, Order[]>();

    for (const order of activeOrders) {
      let key: string;
      if (order.merge_group_id) {
        key = `merge:${order.merge_group_id}`;
      } else if (order.table_id) {
        key = `table:${order.table_id}`;
      } else {
        key = `order:${order.id}`;
      }
      const list = groups.get(key) ?? [];
      list.push(order);
      groups.set(key, list);
    }

    const result: TableGroup[] = [];
    for (const [key, groupOrders] of groups) {
      const names = Array.from(new Set(
        groupOrders.map(o => o.customer_name).filter(Boolean) as string[]
      ));

      const tables = Array.from(new Set(
        groupOrders.filter(o => o.table).map(o =>
          o.table!.display_name?.trim() || String(o.table!.table_number)
        )
      ));
      const hasTable = tables.length > 0;
      const tableLabel = hasTable
        ? tables.join(' + ')
        : groupOrders[0].order_type === 'parcel' ? 'Parcel' : 'Walk-in';

      const items = groupOrders.flatMap(o =>
        (o.items ?? []).filter(i => i.status !== 'voided')
      );

      const oldestReadyAt = Math.min(
        ...groupOrders.map(o => new Date(o.updated_at ?? o.created_at).getTime())
      );

      const readyToBill = groupOrders.every(o => o.status === 'ready' || o.status === 'delivered');

      result.push({
        key,
        tableLabel,
        orders: groupOrders,
        customerNames: names,
        total: groupOrders.reduce((sum, o) => sum + o.total, 0),
        oldestReadyAt,
        items,
        isTable: hasTable,
        orderNumbers: groupOrders.map(o => o.order_number),
        readyToBill,
      });
    }

    result.sort((a, b) => {
      if (a.readyToBill !== b.readyToBill) return a.readyToBill ? -1 : 1;
      return a.oldestReadyAt - b.oldestReadyAt;
    });
    return result;
  }, [activeOrders]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tableGroups;
    return tableGroups.filter(g =>
      g.tableLabel.toLowerCase().includes(q) ||
      g.customerNames.some(n => n.toLowerCase().includes(q))
    );
  }, [tableGroups, searchQuery]);

  async function connectUSBPrinter(printer: PrinterDevice) {
    setConnectingUSB(printer.id);
    try {
      const { printerService } = await import('@/lib/printer-service');
      const result = printer.type === 'serial'
        ? await printerService.connectSerial(printer.id)
        : await printerService.connectUSB(printer.id);
      if (result.success) {
        setDisconnectedUSB(prev => prev.filter(p => p.id !== printer.id));
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

  async function handlePrintBill(billOrders: Order[]) {
    const config = restaurant.billing_config;
    const printerConf = restaurant.printer_config;
    if (!config?.gstin && !config?.legal_name) return;

    const orderData = buildCombinedBillData(billOrders);
    const { buildBillReceipt } = await import('@/lib/escpos-bill');

    if (printerConf?.bill_printer) {
      const printer = printerConf.printers.find(p => p.id === printerConf.bill_printer);
      if (printer && printer.type !== 'browser') {
        const { printerService } = await import('@/lib/printer-service');
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
      const isMergedBilling = orderIds.some(id => orders.find(o => o.id === id)?.merge_group_id);

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
        if (res.status === 409) {
          toast.error('One or more orders changed since you opened this bill — please refresh and try again');
          return;
        }
        throw new Error(d.error || 'Failed to record payment');
      }

      toast.success(`Payment recorded — ${data.payment_method.toUpperCase()}`);

      // Auto-print bill (local-first with broadcast fallback)
      if (restaurant.printer_config?.auto_print_bill) {
        const billedOrders = orderIds.map(id => orders.find(o => o.id === id)).filter((o): o is Order => !!o);
        if (billedOrders.length > 0) {
          const billPrinterId = restaurant.printer_config.bill_printer;
          const billPrinter = billPrinterId
            ? restaurant.printer_config.printers.find(p => p.id === billPrinterId)
            : null;
          if (billPrinter && billPrinter.type !== 'browser') {
            const { printerService } = await import('@/lib/printer-service');
            const locallyPaired =
              (billPrinter.type === 'usb' && printerService.isUSBConnected(billPrinter.id)) ||
              billPrinter.type === 'serial' ||
              billPrinter.type === 'network';
            if (locallyPaired) {
              try { await handlePrintBill(billedOrders); } catch { /* silent */ }
            } else {
              broadcastPrintBill(restaurant.id, buildCombinedBillData(billedOrders)).catch(() => {});
            }
          } else {
            try { await handlePrintBill(billedOrders); } catch { /* silent */ }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setUpdating(null);
    }
  }

  const handleMarkReady = useCallback(async (group: TableGroup) => {
    const pending = group.orders.filter(o => o.status === 'placed');
    if (pending.length === 0) return;
    setUpdating(pending[0].id);
    try {
      await Promise.all(
        pending.map(o =>
          fetch(`/api/staff/orders/${o.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ready' }),
          }).then(res => {
            if (!res.ok) throw new Error(`Failed for order #${o.order_number}`);
          })
        )
      );
      toast.success(
        pending.length === 1
          ? `Order #${pending[0].order_number} marked ready`
          : 'Orders marked ready'
      );
      const isTableService = restaurant.service_mode === 'table_service';
      pending.forEach(o => {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: o.id,
            title: isTableService ? 'Your food is on its way!' : 'Your order is ready!',
            body: isTableService
              ? `Order #${o.order_number} — your food is being brought to your table.`
              : `Order #${o.order_number} — please collect from the counter`,
            url: `/${restaurant.slug}/order/${o.id}`,
          }),
        }).catch(() => {});
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark ready');
    } finally {
      setUpdating(null);
    }
  }, [restaurant.service_mode, restaurant.slug]);

  async function handleCancelOrder(order: Order) {
    const reason = prompt(`Cancel order #${order.order_number}?\nEnter reason:`);
    if (!reason) return;
    setUpdating(order.id);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', reason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to cancel order');
      }
      toast.success(`Order #${order.order_number} cancelled`);

      // KOT reprint for cancelled order
      const activeItems = (order.items ?? []).filter(i => i.status !== 'voided');
      if (activeItems.length > 0) {
        import('@/lib/kot-print').then(({ printModificationKOT }) => {
          printModificationKOT(
            {
              type: 'order_cancelled',
              order_number: order.order_number,
              order_type: order.order_type,
              table: order.table,
              customer_name: order.customer_name,
              items: activeItems.map(i => ({ name: i.name, quantity: i.quantity, notes: i.notes, selected_addons: i.selected_addons })),
              reason,
              created_at: new Date().toISOString(),
            },
            restaurant.name,
            restaurant.printer_config,
          ).catch(() => {});
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setUpdating(null);
    }
  }

  function openVoidDialog(orderId: string, item: OrderItem) {
    setVoidOrderId(orderId);
    setVoidItem(item);
    setVoidDialogOpen(true);
  }

  async function handleDismiss(group: TableGroup) {
    const orderIds = group.orders.map(o => o.id);
    setUpdating(orderIds[0]);
    try {
      const res = await fetch('/api/staff/orders/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds, payment_method: 'cash' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to dismiss');
      }
      toast.success(`${group.tableLabel} dismissed — marked as settled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss');
    } finally {
      setUpdating(null);
    }
  }

  async function mergeGroups(sourceGroup: TableGroup, targetGroup: TableGroup) {
    const allOrderIds = [...sourceGroup.orders, ...targetGroup.orders].map(o => o.id);
    const allEligible = [...sourceGroup.orders, ...targetGroup.orders].every(
      o => (o.status === 'placed' || o.status === 'ready') && !o.payment_method,
    );
    if (!allEligible) {
      toast.error('Cannot merge — all orders must be active and unpaid');
      return;
    }
    const existingGroupId =
      sourceGroup.orders.find(o => o.merge_group_id)?.merge_group_id ??
      targetGroup.orders.find(o => o.merge_group_id)?.merge_group_id;
    const groupId = existingGroupId ?? crypto.randomUUID();

    try {
      const res = await fetch('/api/staff/orders/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: allOrderIds, merge_group_id: groupId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to merge orders');
      }
      toast.success('Orders merged', {
        action: { label: 'Undo', onClick: () => splitMergeGroup(groupId) },
        duration: 5000,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge orders');
    }
  }

  async function splitMergeGroup(mergeGroupId: string) {
    try {
      const res = await fetch('/api/staff/orders/merge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_group_id: mergeGroupId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to split orders');
      }
      toast.success('Orders split');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to split orders');
    }
  }

  function handleDragDrop(sourceKey: string, targetKey: string) {
    setDraggingGroupKey(null);
    setDropTargetGroupKey(null);
    const sourceGroup = filteredGroups.find(g => g.key === sourceKey);
    const targetGroup = filteredGroups.find(g => g.key === targetKey);
    if (sourceGroup && targetGroup) mergeGroups(sourceGroup, targetGroup);
  }

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="w-6 h-6" /> Counter
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mark orders ready &amp; collect payment
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can86 && (
            <button
              onClick={() => setShow86List(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">86 List</span>
              {unavailableCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                  {unavailableCount}
                </span>
              )}
            </button>
          )}
          {activeOrders.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700">
                {activeOrders.length} active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setFilter('active'); setSearchQuery(''); }}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            filter === 'active' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Active
          {activeOrders.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full leading-none">
              {activeOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setFilter('completed'); setSearchQuery(''); }}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            filter === 'completed' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Completed
        </button>
      </div>

      {/* Search */}
      {filter === 'active' && tableGroups.length > 0 && (
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by table or customer…"
            className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Disconnected printer banners */}
      {disconnectedUSB.map(printer => (
        <div key={printer.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span><span className="font-semibold">{printer.name}</span> not connected — bill prints will fail</span>
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

      {/* Active cards */}
      {filter === 'active' && (
        filteredGroups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">
              {searchQuery.trim() ? 'No matches found' : 'No orders waiting'}
            </p>
            <p className="text-xs mt-1">
              {searchQuery.trim() ? 'Try a different search' : 'Orders marked ready will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredGroups.map(group => (
              <TableCard
                key={group.key}
                group={group}
                onCollect={() => setBillingOrders(group.orders)}
                onMarkReady={() => handleMarkReady(group)}
                onDismiss={() => handleDismiss(group)}
                onCancelOrder={handleCancelOrder}
                onVoidItem={openVoidDialog}
                isUpdating={group.orders.some(o => updating === o.id)}
                canMerge={canMerge}
                isDragging={draggingGroupKey === group.key}
                isDropTarget={dropTargetGroupKey === group.key}
                onDragStart={() => setDraggingGroupKey(group.key)}
                onDragOverTarget={(targetKey) => setDropTargetGroupKey(targetKey)}
                onDragDrop={(targetKey) => handleDragDrop(group.key, targetKey)}
                onDragCancel={() => { setDraggingGroupKey(null); setDropTargetGroupKey(null); }}
                onMergeSearch={() => setMergeSearchGroup(group)}
                onSplit={group.key.startsWith('merge:') ? () => splitMergeGroup(group.key.replace('merge:', '')) : undefined}
              />
            ))}
          </div>
        )
      )}

      {/* Completed cards */}
      {filter === 'completed' && (
        completedOrders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No completed orders today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedOrders.map(order => {
              const tableLabel = order.table
                ? (order.table.display_name?.trim() || `#${order.table.table_number}`)
                : null;
              const activeItems = (order.items ?? []).filter(i => i.status !== 'voided');
              const itemSummary = activeItems.length <= 2
                ? activeItems.map(i => `${i.quantity}× ${i.name}`).join(', ')
                : `${activeItems.slice(0, 2).map(i => `${i.quantity}× ${i.name}`).join(', ')} +${activeItems.length - 2} more`;
              return (
                <button
                  key={order.id}
                  onClick={() => setDetailOrder(order)}
                  className="w-full text-left bg-white rounded-xl border px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">#{order.order_number}</span>
                        {tableLabel && <span className="text-xs text-muted-foreground">Table {tableLabel}</span>}
                        {order.customer_name && <span className="text-xs text-muted-foreground">· {order.customer_name}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{itemSummary}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      {order.status === 'cancelled' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Cancelled</span>
                      ) : order.payment_method && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {order.payment_method.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-sm">{formatPrice(order.total)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(order.updated_at ?? order.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      <BillingSheet
        orders={billingOrders}
        restaurant={restaurant}
        onConfirm={handleBillingConfirm}
        onClose={() => setBillingOrders(null)}
      />

      {can86 && (
        <ItemAvailabilityModal
          open={show86List}
          onOpenChange={setShow86List}
          restaurantId={restaurant.id}
        />
      )}

      <VoidItemDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        orderId={voidOrderId}
        item={voidItem}
        onVoided={(info) => {
          refreshOrders();
          if (voidItem && voidOrderId) {
            const order = orders.find(o => o.id === voidOrderId);
            if (order) {
              import('@/lib/kot-print').then(({ printModificationKOT }) => {
                printModificationKOT(
                  {
                    type: 'item_cancelled',
                    order_number: order.order_number,
                    order_type: order.order_type,
                    table: order.table,
                    customer_name: order.customer_name,
                    items: [{ name: voidItem.name, quantity: voidItem.quantity, notes: voidItem.notes, selected_addons: voidItem.selected_addons }],
                    reason: info.reason,
                    created_at: new Date().toISOString(),
                  },
                  restaurant.name,
                  restaurant.printer_config,
                ).catch(() => {});
              });
            }
          }
        }}
      />

      {detailOrder && (
        <CompletedOrderModal
          order={detailOrder}
          restaurant={restaurant}
          onClose={() => setDetailOrder(null)}
          onPrintBill={() => {
            handlePrintBill([detailOrder]);
          }}
        />
      )}

      {mergeSearchGroup && (
        <MergeSearchDialog
          sourceGroup={mergeSearchGroup}
          allGroups={tableGroups}
          onMerge={(targetGroup) => {
            mergeGroups(mergeSearchGroup, targetGroup);
            setMergeSearchGroup(null);
          }}
          onClose={() => setMergeSearchGroup(null)}
        />
      )}
    </div>
  );
}

// ─── Table Card ──────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 500;

function TableCard({
  group,
  onCollect,
  onMarkReady,
  onDismiss,
  onCancelOrder,
  onVoidItem,
  isUpdating,
  canMerge,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOverTarget,
  onDragDrop,
  onDragCancel,
  onMergeSearch,
  onSplit,
}: {
  group: TableGroup;
  onCollect: () => void;
  onMarkReady: () => void;
  onDismiss: () => void;
  onCancelOrder: (order: Order) => void;
  onVoidItem: (orderId: string, item: OrderItem) => void;
  isUpdating: boolean;
  canMerge: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOverTarget: (targetKey: string | null) => void;
  onDragDrop: (targetKey: string) => void;
  onDragCancel: () => void;
  onMergeSearch: () => void;
  onSplit?: () => void;
}) {
  const [expanded, setExpanded] = useState(group.items.length <= 5);
  const waitMinutes = Math.floor((Date.now() - group.oldestReadyAt) / 60_000);
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const nameDisplay =
    group.customerNames.length === 0
      ? null
      : group.customerNames.length <= 3
        ? group.customerNames.join(', ')
        : `${group.customerNames.slice(0, 2).join(', ')} +${group.customerNames.length - 2} more`;

  const isMerged = group.key.startsWith('merge:');
  const allEligible = group.orders.every(o => (o.status === 'placed' || o.status === 'ready') && !o.payment_method);
  const dragEnabled = canMerge && allEligible && !isMerged;

  function handlePointerDown(e: React.PointerEvent) {
    if (!dragEnabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      cardRef.current?.setPointerCapture(e.pointerId);
      setDragOffset({ x: 0, y: 0 });
      onDragStart();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (longPressTimer.current && Math.hypot(dx, dy) > 8) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging) return;
    setDragOffset({ x: dx, y: dy });
    const card = cardRef.current;
    if (card) {
      card.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      card.style.pointerEvents = '';
      const targetEl = el?.closest('[data-group-key]') as HTMLElement | null;
      const targetKey = targetEl?.dataset.groupKey ?? null;
      onDragOverTarget(targetKey && targetKey !== group.key ? targetKey : null);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (!isDragging) return;
    const card = cardRef.current;
    let targetKey: string | null = null;
    if (card) {
      card.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      card.style.pointerEvents = '';
      const targetEl = el?.closest('[data-group-key]') as HTMLElement | null;
      targetKey = targetEl?.dataset.groupKey ?? null;
    }
    setDragOffset({ x: 0, y: 0 });
    if (targetKey && targetKey !== group.key) {
      onDragDrop(targetKey);
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
      data-group-key={group.key}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform: isDragging
          ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.03) rotate(1.5deg)`
          : isDropTarget ? 'scale(1.02)' : undefined,
        transition: isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s',
        zIndex: isDragging ? 50 : isDropTarget ? 10 : undefined,
        position: 'relative',
        ...(dragEnabled ? { touchAction: 'none' as const } : {}),
      }}
      className={cn(
        'bg-white rounded-xl border-2 shadow-sm flex flex-col overflow-hidden',
        group.readyToBill ? 'border-green-300' : 'border-amber-300',
        isDragging && 'opacity-90 shadow-2xl',
        isDropTarget && 'ring-2 ring-violet-400 ring-offset-2',
      )}
    >
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        group.readyToBill ? 'bg-green-50' : 'bg-amber-50',
      )}>
        <div>
          <p className="font-bold text-xl flex items-center gap-2">
            {group.isTable ? (
              `Table ${group.tableLabel}`
            ) : (
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                {group.tableLabel} #{group.orderNumbers[0]}
              </span>
            )}
            {isMerged && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                Merged
              </span>
            )}
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
              group.readyToBill
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700',
            )}>
              {group.readyToBill ? 'Ready' : 'Preparing'}
            </span>
          </p>
          {nameDisplay && (
            <p className="text-sm text-muted-foreground mt-0.5">{nameDisplay}</p>
          )}
          {group.isTable && group.orders.length > 1 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {group.orders.length} orders · #{group.orderNumbers.join(', #')}
            </p>
          )}
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="font-bold text-lg">{formatPrice(group.total)}</p>
          <div className={cn(
            'flex items-center gap-1 text-xs',
            waitMinutes >= 5 ? 'text-red-600 font-semibold' : 'text-muted-foreground',
          )}>
            <Clock className="w-3 h-3" />
            {waitMinutes < 1 ? 'Just now' : `${waitMinutes} min`}
          </div>
          {/* Merge/Split actions */}
          {canMerge && (
            <div className="flex items-center gap-1 mt-0.5">
              {!isMerged && allEligible && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMergeSearch(); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors"
                  title="Merge with another order"
                >
                  <Merge className="w-3 h-3" />
                  Merge
                </button>
              )}
              {onSplit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSplit(); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
                  title="Split merged orders"
                >
                  <Scissors className="w-3 h-3" />
                  Split
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex-1">
        {group.items.length > 5 ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {group.items.length} items
            </button>
            {expanded && <ItemsList items={group.items} onVoidItem={onVoidItem} />}
          </>
        ) : (
          <ItemsList items={group.items} onVoidItem={onVoidItem} />
        )}
      </div>

      {/* Cancel order button(s) */}
      {group.orders.length === 1 ? (
        <div className="px-4 pb-1">
          <button
            onClick={() => onCancelOrder(group.orders[0])}
            disabled={isUpdating}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel order
          </button>
        </div>
      ) : (
        <div className="px-4 pb-1 flex flex-wrap gap-2">
          {group.orders.map(o => (
            <button
              key={o.id}
              onClick={() => onCancelOrder(o)}
              disabled={isUpdating}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel #{o.order_number}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-1 space-y-2">
        {group.readyToBill ? (
          <>
            <button
              onClick={onCollect}
              disabled={isUpdating}
              className="w-full py-3.5 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                '...'
              ) : (
                <>
                  <IndianRupee className="w-5 h-5" />
                  Collect {formatPrice(group.total)}
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              disabled={isUpdating}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Already settled
            </button>
          </>
        ) : (
          <button
            onClick={onMarkReady}
            disabled={isUpdating}
            className="w-full py-3.5 rounded-xl text-base font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              '...'
            ) : (
              <>
                <ChefHat className="w-5 h-5" />
                {group.items.length === 1 ? 'Mark Ready' : 'Mark All Ready'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Items List ──────────────────────────────────────────────────────────────

function ItemsList({ items, onVoidItem }: { items: OrderItem[]; onVoidItem?: (orderId: string, item: OrderItem) => void }) {
  return (
    <div className="space-y-1.5">
      {items.map(item => {
        const addonTotal = (item.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
        return (
          <div key={item.id}>
            <div className="flex justify-between gap-2 items-start">
              <span className="text-sm">
                <span className="font-semibold">{item.quantity}×</span> {item.name}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatPrice((item.price + addonTotal) * item.quantity)}
                </span>
                {onVoidItem && (
                  <button
                    onClick={() => onVoidItem(item.order_id, item)}
                    className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                    title="Void item"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
            {(item.selected_addons ?? []).map((addon, ai) => (
              <div key={ai} className="flex justify-between gap-2 pl-5">
                <span className="text-xs text-muted-foreground">+ {addon.name}</span>
                {addon.price > 0 && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    +{formatPrice(addon.price)}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Merge Search Dialog ────────────────────────────────────────────────────

function MergeSearchDialog({
  sourceGroup,
  allGroups,
  onMerge,
  onClose,
}: {
  sourceGroup: TableGroup;
  allGroups: TableGroup[];
  onMerge: (target: TableGroup) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<TableGroup | null>(null);
  const [loading, setLoading] = useState(false);

  const candidates = useMemo(() => {
    return allGroups.filter(g => {
      if (g.key === sourceGroup.key) return false;
      const eligible = g.orders.every(o => (o.status === 'placed' || o.status === 'ready') && !o.payment_method);
      if (!eligible) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        g.tableLabel.toLowerCase().includes(q) ||
        g.customerNames.some(n => n.toLowerCase().includes(q)) ||
        g.orderNumbers.some(n => String(n).includes(q))
      );
    });
  }, [allGroups, sourceGroup.key, query]);

  async function handleConfirm() {
    if (!confirming) return;
    setLoading(true);
    await onMerge(confirming);
    setLoading(false);
  }

  if (confirming) {
    const srcName = sourceGroup.customerNames[0];
    const destName = confirming.customerNames[0];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Merge className="w-5 h-5 text-violet-600" />
            Merge orders?
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="font-bold text-sm">{sourceGroup.tableLabel}</p>
              {srcName && <p className="text-xs text-muted-foreground mt-0.5">{srcName}</p>}
              <p className="text-xs font-semibold mt-1">{formatPrice(sourceGroup.total)}</p>
              <p className="text-[10px] text-muted-foreground">{sourceGroup.orders.length} order{sourceGroup.orders.length !== 1 ? 's' : ''}</p>
            </div>
            <Merge className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <div className="flex-1 p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="font-bold text-sm">{confirming.tableLabel}</p>
              {destName && <p className="text-xs text-muted-foreground mt-0.5">{destName}</p>}
              <p className="text-xs font-semibold mt-1">{formatPrice(confirming.total)}</p>
              <p className="text-[10px] text-muted-foreground">{confirming.orders.length} order{confirming.orders.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-center text-xs text-muted-foreground">
            Combined: <strong>{formatPrice(sourceGroup.total + confirming.total)}</strong> · {sourceGroup.items.length + confirming.items.length} items
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
            >
              Back
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
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
            <Merge className="w-5 h-5 text-violet-600" />
            Merge with…
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Select an order to merge with <strong>{sourceGroup.tableLabel}</strong>
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by table, customer, or order #…"
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-5 pb-5 space-y-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {query.trim() ? 'No matching orders' : 'No other orders to merge with'}
            </p>
          ) : (
            candidates.map(g => (
              <button
                key={g.key}
                onClick={() => setConfirming(g)}
                className="w-full text-left p-3 rounded-xl border hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{g.isTable ? `Table ${g.tableLabel}` : `${g.tableLabel} #${g.orderNumbers[0]}`}</p>
                    {g.customerNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">{g.customerNames.join(', ')}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatPrice(g.total)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {g.items.length} item{g.items.length !== 1 ? 's' : ''} · {g.orders.length} order{g.orders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
