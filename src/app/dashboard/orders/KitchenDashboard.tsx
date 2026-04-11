'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { BellRing, ChefHat, CheckCheck, IndianRupee, XCircle, Printer, ReceiptText, Usb, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import PrintOrderDialog from '@/components/dashboard/PrintOrderDialog';
import type { Order, OrderStatus, Restaurant, PrinterDevice } from '@/types';

interface Props {
  restaurant: Restaurant;
  initialOrders: Order[];
}

type FilterTab = 'active' | 'all' | 'completed';

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  placed:    'ready',
  ready:     'completed',
  completed: null,
  cancelled: null,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed:    'Food Ready',
  ready:     'Record Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function KitchenDashboard({ restaurant, initialOrders }: Props) {
  console.log('[KitchenDashboard] rendered, restaurant.id:', restaurant.id);
  const [orders, setOrders]   = useState<Order[]>(initialOrders);
  const [filter, setFilter]   = useState<FilterTab>('active');
  const [updating, setUpdating] = useState<string | null>(null);

  // Print dialog state
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printMode, setPrintMode]   = useState<'accept' | 'reprint'>('accept');

  // USB printer connection state — tracks which USB printers failed to auto-reconnect
  const [disconnectedUSB, setDisconnectedUSB] = useState<PrinterDevice[]>([]);
  const [connectingUSB, setConnectingUSB] = useState<string | null>(null);

  const isFirstRender = useRef(true);
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

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    console.log('[realtime] setting up channel for restaurant:', restaurant.id);
    const supabase = createClient();

    const channel = supabase
      .channel(`kitchen-orders-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isFirstRender.current) return;
            const { data } = await supabase
              .from('orders')
              .select('*, items:order_items(*), table:tables(*)')
              .eq('id', payload.new.id)
              .single();
            if (data) {
              const newOrder = data as Order;
              setOrders((prev) => [newOrder, ...prev]);
              console.log(`[realtime] New order #${newOrder.order_number}`);
            }
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        },
      )
      .subscribe((status) => { console.log('[realtime] subscription status:', status); });

    isFirstRender.current = false;
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // ── Status helpers ─────────────────────────────────────────────────────────
  async function advanceStatus(order: Order) {
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order');
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setUpdating(null);
    }
  }

  // ── Print dialog handlers ──────────────────────────────────────────────────

  // "Start Preparing" — show print dialog; status advances after confirm/skip
  function openAcceptDialog(order: Order) {
    setPrintMode('accept');
    setPrintOrder(order);
  }

  // Printer icon button on any card — print only, no status change
  function openReprintDialog(order: Order) {
    setPrintMode('reprint');
    setPrintOrder(order);
  }

  // Called by dialog on print OR skip
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

    // Browser fallback
    const { printCustomerBill } = await import('@/lib/billing');
    printCustomerBill(order, restaurant, config!);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (filter === 'active')    return o.status === 'placed' || o.status === 'ready';
    if (filter === 'completed') return o.status === 'completed' || o.status === 'cancelled';
    return true;
  });

  // Only 'placed' orders are urgent (kitchen hasn't finished yet)
  const activeCount = orders.filter((o) => o.status === 'placed').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-3">
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
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
            <BellRing className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">{activeCount} active</span>
          </div>
        )}
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
            onClick={() => setFilter(key)}
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

      {/* ── Orders grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">
            {filter === 'active' ? 'No active orders' : 'No orders yet today'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              restaurant={restaurant}
              onAdvance={() => advanceStatus(order)}
              onCancel={() => cancelOrder(order)}
              onReprint={() => openReprintDialog(order)}
              onPrintBill={() => handlePrintBill(order)}
              isUpdating={updating === order.id}
            />
          ))}
        </div>
      )}

      {/* ── Print dialog (portal, rendered once at dashboard level) ── */}
      <PrintOrderDialog
        order={printOrder}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        mode={printMode}
        onConfirm={handlePrintConfirm}
        onClose={() => setPrintOrder(null)}
        printerConfig={restaurant.printer_config}
      />
    </div>
  );
}

// ── OrderCard ──────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  restaurant: Restaurant;
  onAdvance: () => void;
  onCancel: () => void;
  onReprint: () => void;
  onPrintBill: () => void;
  isUpdating: boolean;
}

function OrderCard({ order, onAdvance, onCancel, onReprint, onPrintBill, isUpdating }: OrderCardProps) {
  const statusMeta = ORDER_STATUSES.find((s) => s.value === order.status);
  const isTerminal = order.status === 'completed' || order.status === 'cancelled';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden',
        order.status === 'placed'    && 'border-amber-300',
        order.status === 'ready'     && 'border-green-400',
        order.status === 'completed' && 'border-gray-200 opacity-70',
        order.status === 'cancelled' && 'border-red-200 opacity-60',
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
          {/* Reprint button — visible on all non-terminal orders */}
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
        <p className="text-sm font-medium">
          {order.order_type === 'dine_in'
            ? order.table ? `🪑 Table ${order.table.display_name?.trim() || order.table.table_number}` : '🪑 Dine In'
            : `🛍️ Parcel${order.customer_name ? ` — ${order.customer_name}` : ''}`}
        </p>
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
