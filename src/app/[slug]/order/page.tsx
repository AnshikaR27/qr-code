'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { buildMenuTokens } from '@/lib/tokens';
import { typeScale, spacingScale } from '@/lib/sunday-scale';

interface PendingItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

interface PendingOrder {
  restaurant_id: string;
  table_id: string | null;
  order_type: 'dine_in' | 'parcel';
  customer_name: string | null;
  customer_phone: string | null;
  notes?: string | null;
  items: PendingItem[];
}

const SUNDAY_TOKEN_VARS = [
  '--sunday-primary', '--sunday-accent', '--sunday-bg', '--sunday-card-bg',
  '--sunday-nav-bg', '--sunday-surface-low', '--sunday-text', '--sunday-text-muted',
  '--sunday-border', '--sunday-radius', '--sunday-font-heading', '--sunday-font-body',
  '--sunday-shadow-sm', '--sunday-shadow-md', '--sunday-shadow-lg',
] as const;

export default function OrderReviewPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [placing, setPlacing] = useState(false);

  // Re-apply Sunday design tokens — CustomerMenuV2 removes them from :root on unmount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('menuDesignTokens');
      const t = buildMenuTokens(raw ? JSON.parse(raw) : null);
      const vars: Record<string, string> = {
        '--sunday-primary': t.primary,
        '--sunday-accent': t.accent,
        '--sunday-bg': t.bg,
        '--sunday-card-bg': t.cardBg,
        '--sunday-nav-bg': t.navBg,
        '--sunday-surface-low': t.surfaceLow,
        '--sunday-text': t.text,
        '--sunday-text-muted': t.textMuted,
        '--sunday-border': t.border,
        '--sunday-radius': t.radius,
        '--sunday-font-heading': t.fontHeading,
        '--sunday-font-body': t.fontBody,
        '--sunday-shadow-sm': t.shadowSm,
        '--sunday-shadow-md': t.shadowMd,
        '--sunday-shadow-lg': t.shadowLg,
      };
      const root = document.documentElement;
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      return () => { for (const k of SUNDAY_TOKEN_VARS) root.style.removeProperty(k); };
    } catch { /* ignore — defaults in CSS vars handle gracefully */ }
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingOrder');
    if (!raw) { router.replace(`/${slug}`); return; }
    try {
      setOrder(JSON.parse(raw));
    } catch {
      router.replace(`/${slug}`);
    }
  }, [router, slug]);

  if (!order) {
    return (
      <div
        className="flex items-center justify-center min-h-[100dvh]"
        style={{ backgroundColor: 'var(--sunday-bg, #FFF8F0)' }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
      </div>
    );
  }

  const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  async function confirmOrder() {
    if (!order) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to place order');
      sessionStorage.removeItem('pendingOrder');
      router.replace(`/${slug}/order/${data.orderId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setPlacing(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--sunday-radius, 12px)',
    backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
    border: '1px solid var(--sunday-border, #E8D5B0)',
    boxShadow: 'var(--sunday-shadow-sm)',
  };

  const dividerColor = 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)';

  return (
    <div
      className="min-h-[100dvh] flex flex-col max-w-[480px] mx-auto"
      style={{ backgroundColor: 'var(--sunday-bg, #FFF8F0)', fontFamily: 'var(--sunday-font-body)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 shrink-0 border-b sticky top-0 z-10"
        style={{
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: spacingScale.cardPad,
          paddingBottom: spacingScale.cardPad,
          backgroundColor: 'var(--sunday-nav-bg, #efebe2)',
          borderColor: dividerColor,
          boxShadow: 'var(--sunday-shadow-sm)',
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex items-center justify-center shrink-0"
          style={{ width: 36, height: 36, color: 'var(--sunday-text, #1D1208)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <h1
          className="flex-1 text-center font-bold"
          style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-heading)' }}
        >
          Review Order
        </h1>
        {/* Spacer keeps title centred */}
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto flex flex-col"
        style={{
          gap: spacingScale.gap,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: spacingScale.gap,
          paddingBottom: '24px',
        }}
      >
        {/* Order type pill */}
        <div className="flex items-center gap-2">
          <span
            className="font-semibold"
            style={{
              fontSize: typeScale.xs,
              padding: '4px 12px',
              borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
              backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
              color: 'var(--sunday-text-muted, #7A6040)',
              border: '1px solid var(--sunday-border, #E8D5B0)',
              fontFamily: 'var(--sunday-font-body)',
            }}
          >
            {order.order_type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
          </span>
          {order.order_type === 'parcel' && order.customer_name && (
            <span style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              {order.customer_name}
            </span>
          )}
        </div>

        {/* Items card */}
        <div style={cardStyle} className="overflow-hidden">
          <div
            className="border-b"
            style={{
              paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
              paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
              borderColor: dividerColor,
            }}
          >
            <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              Items
            </p>
          </div>
          <ul className="m-0 p-0 list-none">
            {order.items.map((item) => (
              <li
                key={item.product_id}
                className="border-b last:border-0"
                style={{
                  paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
                  paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
                  borderColor: dividerColor,
                }}
              >
                <div className="flex justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium" style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                      {item.quantity}× {item.name}
                    </span>
                    {item.notes && (
                      <p className="mt-0.5 italic m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                        &ldquo;{item.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <span className="font-semibold shrink-0" style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Order note */}
        {order.notes && (
          <div
            style={{
              ...cardStyle,
              paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
              paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
            }}
          >
            <p className="font-semibold m-0 mb-1" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              Order Note
            </p>
            <p className="italic m-0" style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              &ldquo;{order.notes}&rdquo;
            </p>
          </div>
        )}

        {/* Subtotal */}
        <div
          className="flex justify-between items-center"
          style={{
            ...cardStyle,
            paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
            paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
          }}
        >
          <span className="font-semibold" style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
            Subtotal
          </span>
          <span className="font-bold" style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
            {formatPrice(total)}
          </span>
        </div>

        {/* Customer details — parcel only */}
        {order.order_type === 'parcel' && (order.customer_name || order.customer_phone) && (
          <div
            style={{
              ...cardStyle,
              paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
              paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}
          >
            <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)', marginBottom: '4px' }}>
              Your Details
            </p>
            {order.customer_name && (
              <p className="m-0" style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                <span style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>Name: </span>
                {order.customer_name}
              </p>
            )}
            {order.customer_phone && (
              <p className="m-0" style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                <span style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>Phone: </span>
                {order.customer_phone}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div
        className="shrink-0 border-t"
        style={{
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: spacingScale.cardPad,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
          borderColor: dividerColor,
        }}
      >
        <button
          onClick={confirmOrder}
          disabled={placing}
          aria-label={`Confirm order for ${formatPrice(total)}`}
          className="w-full font-bold border-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            fontSize: typeScale.lg,
            paddingTop: '14px',
            paddingBottom: '14px',
            borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
            background: 'linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))',
            color: '#FFFFFF',
            boxShadow: 'var(--sunday-shadow-md)',
            fontFamily: 'var(--sunday-font-body)',
          }}
        >
          {placing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Placing Order…
            </>
          ) : (
            `Confirm Order · ${formatPrice(total)}`
          )}
        </button>
      </div>
    </div>
  );
}
