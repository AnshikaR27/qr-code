'use client';

import { useMemo, useState, useEffect } from 'react';
import { IndianRupee, Clock, ChevronDown, ChevronUp, ShoppingBag, AlertTriangle, Usb } from 'lucide-react';
import { toast } from 'sonner';
import { useOrders } from '@/contexts/OrdersContext';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import { broadcastPrintBill } from '@/lib/bill-print-broadcast';
import { buildCombinedBillData } from '@/lib/billing';
import BillingSheet, { type BillingConfirmData } from '@/components/dashboard/BillingSheet';
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
}

export default function CounterDashboard() {
  const { orders } = useOrders();
  const { restaurant } = useStaff();
  const [billingOrders, setBillingOrders] = useState<Order[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [disconnectedUSB, setDisconnectedUSB] = useState<PrinterDevice[]>([]);
  const [connectingUSB, setConnectingUSB] = useState<string | null>(null);

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

  const readyUnpaid = useMemo(
    () => orders.filter(o => (o.status === 'ready' || o.status === 'delivered') && !o.payment_method),
    [orders],
  );

  // Re-render every minute to keep "X min" labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (readyUnpaid.length === 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [readyUnpaid.length]);

  // Group by merge_group_id > table_id > individual (no-table)
  const tableGroups = useMemo<TableGroup[]>(() => {
    const groups = new Map<string, Order[]>();

    for (const order of readyUnpaid) {
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
      });
    }

    result.sort((a, b) => a.oldestReadyAt - b.oldestReadyAt);
    return result;
  }, [readyUnpaid]);

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

      toast.success(
        isMergedBilling
          ? 'Payment recorded · tables unmerged'
          : `Payment recorded — ${data.payment_method.toUpperCase()}`,
      );

      // Auto-print bill (local-first with broadcast fallback)
      if (!isMergedBilling && restaurant.printer_config?.auto_print_bill) {
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

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="w-6 h-6" /> Counter
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect payment for ready orders
          </p>
        </div>
        {tableGroups.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              {tableGroups.length} waiting
            </span>
          </div>
        )}
      </div>

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

      {/* Table cards */}
      {tableGroups.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No orders waiting</p>
          <p className="text-xs mt-1">Orders marked ready will appear here</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tableGroups.map(group => (
            <TableCard
              key={group.key}
              group={group}
              onCollect={() => setBillingOrders(group.orders)}
              isUpdating={group.orders.some(o => updating === o.id)}
            />
          ))}
        </div>
      )}

      <BillingSheet
        orders={billingOrders}
        restaurant={restaurant}
        onConfirm={handleBillingConfirm}
        onClose={() => setBillingOrders(null)}
      />
    </div>
  );
}

// ─── Table Card ──────────────────────────────────────────────────────────────

function TableCard({
  group,
  onCollect,
  isUpdating,
}: {
  group: TableGroup;
  onCollect: () => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(group.items.length <= 5);
  const waitMinutes = Math.floor((Date.now() - group.oldestReadyAt) / 60_000);

  const nameDisplay =
    group.customerNames.length === 0
      ? null
      : group.customerNames.length <= 3
        ? group.customerNames.join(', ')
        : `${group.customerNames.slice(0, 2).join(', ')} +${group.customerNames.length - 2} more`;

  return (
    <div className="bg-white rounded-xl border-2 border-green-300 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-green-50 flex items-center justify-between">
        <div>
          <p className="font-bold text-xl">
            {group.isTable ? (
              `Table ${group.tableLabel}`
            ) : (
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                {group.tableLabel} #{group.orderNumbers[0]}
              </span>
            )}
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
        <div className="text-right">
          <p className="font-bold text-lg">{formatPrice(group.total)}</p>
          <div className={cn(
            'flex items-center gap-1 mt-0.5 text-xs justify-end',
            waitMinutes >= 5 ? 'text-red-600 font-semibold' : 'text-muted-foreground',
          )}>
            <Clock className="w-3 h-3" />
            {waitMinutes < 1 ? 'Just now' : `${waitMinutes} min`}
          </div>
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
            {expanded && <ItemsList items={group.items} />}
          </>
        ) : (
          <ItemsList items={group.items} />
        )}
      </div>

      {/* Collect button */}
      <div className="px-4 pb-4 pt-1">
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
      </div>
    </div>
  );
}

// ─── Items List ──────────────────────────────────────────────────────────────

function ItemsList({ items }: { items: OrderItem[] }) {
  return (
    <div className="space-y-1.5">
      {items.map(item => {
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
