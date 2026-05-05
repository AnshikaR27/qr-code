'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { X, Clock, CheckCircle2, PackageCheck, ChevronRight, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { typeScale, spacingScale } from '@/lib/sunday-scale';
import { getTrackedOrders, updateTrackedOrderStatus, type TrackedOrder } from '@/lib/tracked-orders';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: typeof Clock; color: string }> = {
  placed:    { label: 'Preparing',  icon: Clock,        color: 'var(--sunday-accent, #b12d00)' },
  ready:     { label: 'Ready',      icon: PackageCheck,  color: 'var(--sunday-veg, #0F8A00)' },
  delivered: { label: 'Served',     icon: CheckCircle2,  color: 'var(--sunday-veg, #0F8A00)' },
  cancelled: { label: 'Cancelled',  icon: XCircle,       color: '#dc2626' },
};

export default function YourOrdersSheet({ open, onClose, slug }: Props) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (open) {
      setOrders(getTrackedOrders());
      setMounted(true);
      setExiting(false);
      document.body.style.overflow = 'hidden';
    } else if (mounted) {
      setExiting(true);
      document.body.style.overflow = '';
      exitTimer.current = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, 300);
    }
    return () => { if (exitTimer.current) clearTimeout(exitTimer.current); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStatuses = useCallback(async () => {
    const tracked = getTrackedOrders();
    if (tracked.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, status')
      .in('id', tracked.map(o => o.orderId));
    if (!data) return;
    for (const row of data) {
      const existing = tracked.find(o => o.orderId === row.id);
      if (existing && existing.status !== row.status) {
        updateTrackedOrderStatus(row.id, row.status as OrderStatus);
      }
    }
    setOrders(getTrackedOrders());
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshStatuses();
    const interval = setInterval(refreshStatuses, 15_000);
    return () => clearInterval(interval);
  }, [open, refreshStatuses]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const animClass = exiting ? 'sheet-exit' : 'sheet-enter';
  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');

  return (
    <>
      <style>{`
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheetSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @keyframes sheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetFadeOut { from { opacity: 1; } to { opacity: 0; } }
        .sheet-enter { animation: sheetSlideUp 300ms cubic-bezier(0.32,0.72,0,1) both; }
        .sheet-exit { animation: sheetSlideDown 300ms cubic-bezier(0.32,0.72,0,1) both; }
        .backdrop-enter { animation: sheetFadeIn 200ms ease both; }
        .backdrop-exit { animation: sheetFadeOut 200ms ease both; }
      `}</style>

      {/* Backdrop */}
      <div
        className={exiting ? 'backdrop-exit' : 'backdrop-enter'}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Sheet */}
      <div
        className={animClass}
        style={{
          position: 'fixed',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          maxHeight: '80dvh',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--sunday-bg, #FFF8F0)',
          borderRadius: 'calc(var(--sunday-radius, 12px) * 2) calc(var(--sunday-radius, 12px) * 2) 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
          fontFamily: 'var(--sunday-font-body)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0 border-b"
          style={{
            padding: spacingScale.px,
            borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
          }}
        >
          <h2
            className="font-bold m-0"
            style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-heading)' }}
          >
            Your Orders
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center border-none cursor-pointer"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
              color: 'var(--sunday-text-muted, #7A6040)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: spacingScale.px }}>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span style={{ fontSize: 40 }}>🧾</span>
              <p className="m-0" style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)' }}>
                No orders yet
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeOrders.length > 0 && activeOrders.map(order => (
                <OrderCard key={order.orderId} order={order} slug={slug} />
              ))}

              {pastOrders.length > 0 && (
                <>
                  {activeOrders.length > 0 && (
                    <p
                      className="m-0 font-semibold"
                      style={{
                        fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        marginTop: 4,
                      }}
                    >
                      Earlier
                    </p>
                  )}
                  {pastOrders.map(order => (
                    <OrderCard key={order.orderId} order={order} slug={slug} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function OrderCard({ order, slug }: { order: TrackedOrder; slug: string }) {
  const config = STATUS_CONFIG[order.status];
  const Icon = config.icon;
  const isDone = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <Link
      href={`/${slug}/order/${order.orderId}`}
      className="no-underline"
      style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        padding: spacingScale.cardPad,
        borderRadius: 'var(--sunday-radius, 12px)',
        backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
        border: '1px solid var(--sunday-border, #E8D5B0)',
        boxShadow: 'var(--sunday-shadow-sm)',
        opacity: isDone ? 0.6 : 1,
      }}
    >
      {/* Top row: order number + status + chevron */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="font-bold"
            style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1D1208)' }}
          >
            Order #{order.orderNumber}
          </span>
          <span
            className="flex items-center gap-1 font-semibold"
            style={{
              fontSize: typeScale.xs,
              color: config.color,
              padding: '2px 8px',
              borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
              backgroundColor: `color-mix(in srgb, ${config.color} 10%, transparent)`,
            }}
          >
            <Icon size={12} />
            {config.label}
          </span>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--sunday-text-muted, #7A6040)', flexShrink: 0 }} />
      </div>

      {/* Items summary */}
      <p
        className="m-0"
        style={{
          fontSize: typeScale.sm,
          color: 'var(--sunday-text-muted, #7A6040)',
          lineHeight: 1.4,
        }}
      >
        {order.items.map((item, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
          </span>
        ))}
      </p>

      {/* Total */}
      <span
        className="font-semibold"
        style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)' }}
      >
        {formatPrice(order.total)}
      </span>
    </Link>
  );
}
