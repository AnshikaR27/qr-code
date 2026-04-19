'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, Clock, PackageCheck, UtensilsCrossed } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { buildMenuTokens } from '@/lib/tokens';
import { typeScale, spacingScale } from '@/lib/sunday-scale';
import { startReadyChimeLoop, stopReadyChimeLoop, playPreparingChime, unlockCustomerAudio } from '@/lib/customer-chime';
import type { Order, OrderItem, OrderStatus } from '@/types';

type ServiceMode = 'self_service' | 'table_service';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isIOS() {
  return typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
}

const STEPS_SELF: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'placed',    label: 'Order Placed',    icon: Clock        },
  { status: 'ready',     label: 'Ready to Collect', icon: PackageCheck },
  { status: 'delivered', label: 'Picked Up',        icon: CheckCircle2 },
];

const STEPS_TABLE: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'placed',    label: 'Order Placed', icon: Clock           },
  { status: 'ready',     label: 'On its Way',   icon: UtensilsCrossed },
  { status: 'delivered', label: 'Served',       icon: CheckCircle2    },
];

function statusIndex(s: OrderStatus, steps: typeof STEPS_SELF) {
  const idx = steps.findIndex((step) => step.status === s);
  return idx === -1 ? steps.length : idx;
}

const EST_MINUTES = 15;

const SUNDAY_TOKEN_VARS = [
  '--sunday-primary', '--sunday-accent', '--sunday-bg', '--sunday-card-bg',
  '--sunday-nav-bg', '--sunday-surface-low', '--sunday-text', '--sunday-text-muted',
  '--sunday-border', '--sunday-radius', '--sunday-font-heading', '--sunday-font-body',
  '--sunday-shadow-sm', '--sunday-shadow-md', '--sunday-shadow-lg', '--sunday-veg',
] as const;

export default function OrderStatusPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [serviceMode, setServiceMode] = useState<ServiceMode>('self_service');
  const serviceModeRef = useRef<ServiceMode>('self_service');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prevStatus, setPrevStatus] = useState<OrderStatus | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [notifPerm, setNotifPerm] = useState<'default' | 'granted' | 'denied'>('default');
  const audioUnlockedRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [ios, setIos] = useState(false);
  const orderRef = useRef<Order | null>(null);
  const pendingChimeRef = useRef(false);
  useEffect(() => { setIos(isIOS()); }, []);
  useEffect(() => { serviceModeRef.current = serviceMode; }, [serviceMode]);
  useEffect(() => { orderRef.current = order; }, [order]);

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
        '--sunday-veg': t.veg,
      };
      const root = document.documentElement;
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      return () => { for (const k of SUNDAY_TOKEN_VARS) root.style.removeProperty(k); };
    } catch { /* ignore — defaults in CSS vars handle gracefully */ }
  }, []);

  const handleFirstInteraction = useCallback(() => {
    if (!audioUnlockedRef.current) {
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      unlockCustomerAudio().then(() => {
        if (pendingChimeRef.current) {
          pendingChimeRef.current = false;
          startReadyChimeLoop();
        }
      }).catch(() => {});
    } else {
      stopReadyChimeLoop();
    }
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPerm(Notification.permission as 'default' | 'granted' | 'denied');
      if (Notification.permission === 'granted') subscribeToPush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    handleFirstInteraction();
    const perm = await Notification.requestPermission();
    setNotifPerm(perm as 'default' | 'granted' | 'denied');
    if (perm === 'granted') subscribeToPush();
  }

  async function subscribeToPush() {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, subscription: subscription.toJSON() }),
      });
    } catch (err) {
      console.warn('[push] subscription failed:', err);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    async function fetchOrder() {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, items:order_items(*), restaurant:restaurants(service_mode)')
        .eq('id', orderId)
        .single();

      if (err || !data) {
        setError('Order not found');
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mode = (data as any).restaurant?.service_mode as ServiceMode | undefined;
      const resolvedMode = mode ?? 'self_service';
      setServiceMode(resolvedMode);
      serviceModeRef.current = resolvedMode;
      const loadedOrder = data as Order;
      setOrder(loadedOrder);
      orderRef.current = loadedOrder;
      setItems((data.items ?? []) as OrderItem[]);
      setPrevStatus(loadedOrder.status);
      setLoading(false);

      if (loadedOrder.status === 'ready' && resolvedMode === 'self_service') {
        pendingChimeRef.current = true;
      }
    }

    void fetchOrder();

    function refreshStatus() {
      supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const newStatus = (data as { status: OrderStatus }).status;
          const prev = orderRef.current?.status;
          if (!prev || prev === newStatus) return;
          setOrder((o) => o ? { ...o, status: newStatus } : o);
          if (orderRef.current) orderRef.current = { ...orderRef.current, status: newStatus };
          if (newStatus === 'ready' && serviceModeRef.current === 'self_service') {
            try {
              if (audioUnlockedRef.current) startReadyChimeLoop();
              else pendingChimeRef.current = true;
              navigator.vibrate?.([400, 150, 400, 150, 400]);
            } catch { /* audio/vibrate may fail after tab restore */ }
          }
          if (newStatus === 'delivered') {
            setShowCelebration(true);
            setTimeout(() => setShowCelebration(false), 5000);
          }
        })
        .then(undefined, () => {});
    }

    let subscribedOnce = false;
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const newStatus = (payload.new as Partial<Order>).status;
          setOrder((prev) => prev ? { ...prev, ...(payload.new as Partial<Order>) } : prev);
          setPrevStatus((prev) => {
            if (newStatus === 'delivered' && prev !== 'delivered') {
              setShowCelebration(true);
              setTimeout(() => setShowCelebration(false), 5000);
            }
            if (newStatus && newStatus !== prev) {
              try {
                if (newStatus === 'ready') {
                  const mode = serviceModeRef.current;
                  const orderNum = (payload.new as Partial<Order>).order_number ?? '';
                  if (mode === 'self_service') {
                    if (audioUnlockedRef.current) startReadyChimeLoop();
                    else pendingChimeRef.current = true;
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      navigator.vibrate([400, 150, 400, 150, 400]);
                    }
                  }
                  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification(
                      mode === 'table_service' ? 'Your food is on its way! 🍽️' : 'Your order is ready! 🔔',
                      {
                        body: mode === 'table_service'
                          ? `Order #${orderNum} — your food is being brought to your table.`
                          : `Order #${orderNum} — please collect from the counter.`,
                        icon: '/favicon.ico',
                      }
                    );
                  }
                } else if (newStatus === 'preparing') {
                  playPreparingChime();
                }
              } catch { /* browser APIs may throw after tab freeze/restore */ }
            }
            return newStatus ?? prev;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!subscribedOnce) {
            subscribedOnce = true;
          } else {
            refreshStatus();
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      stopReadyChimeLoop();
    };
  }, [orderId]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[100dvh]"
        style={{ backgroundColor: 'var(--sunday-bg, #FFF8F0)' }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--sunday-text-muted, #7A6040)' }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[100dvh] gap-3 px-4"
        style={{ backgroundColor: 'var(--sunday-bg, #FFF8F0)' }}
      >
        <p style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
          {error || 'Order not found'}
        </p>
        <Link
          href={`/${slug}`}
          className="underline underline-offset-2"
          style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
        >
          Back to menu
        </Link>
      </div>
    );
  }

  const isTableService = serviceMode === 'table_service';
  const STEPS = isTableService ? STEPS_TABLE : STEPS_SELF;
  const currentIdx = statusIndex(order.status, STEPS);
  const isCompleted = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isReady     = order.status === 'ready';
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--sunday-radius, 12px)',
    backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
    border: '1px solid var(--sunday-border, #E8D5B0)',
    boxShadow: 'var(--sunday-shadow-sm)',
  };
  const dividerColor = 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)';

  // Animated status card background — derived from Sunday tokens, no semantic Tailwind colours
  const statusCardStyle: React.CSSProperties = {
    ...cardStyle,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center',
    ...(order.status === 'placed'
      ? {
          backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
          borderColor: 'var(--sunday-border, #E8D5B0)',
        }
      : isReady && !isTableService
      ? {
          backgroundColor: 'color-mix(in srgb, var(--sunday-veg, #0F8A00) 8%, var(--sunday-bg, #FFF8F0))',
          borderColor: 'color-mix(in srgb, var(--sunday-veg, #0F8A00) 30%, transparent)',
        }
      : {
          backgroundColor: 'color-mix(in srgb, var(--sunday-accent, #b12d00) 8%, var(--sunday-bg, #FFF8F0))',
          borderColor: 'color-mix(in srgb, var(--sunday-accent, #b12d00) 30%, transparent)',
        }
    ),
  };

  const bannerBase: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingLeft: spacingScale.px,
    paddingRight: spacingScale.px,
    paddingTop: spacingScale.cardPad,
    paddingBottom: spacingScale.cardPad,
    borderRadius: 'var(--sunday-radius, 12px)',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'none',
    border: '1px solid var(--sunday-border, #E8D5B0)',
    backgroundColor: 'var(--sunday-surface-low, #f6f2e9)',
  };

  return (
    <>
      <style>{`
        @keyframes cookingBounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%       { transform: translateY(-8px) rotate(5deg); }
        }
        @keyframes bellSwing {
          0%, 100% { transform: rotate(0); }
          20%       { transform: rotate(-25deg); }
          40%       { transform: rotate(25deg); }
          60%       { transform: rotate(-15deg); }
          80%       { transform: rotate(15deg); }
        }
        @keyframes celebPop {
          0%   { transform: scale(0.5) translateY(20px); opacity: 0; }
          60%  { transform: scale(1.15) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes confettiDrop {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: absolute;
          width: 8px; height: 8px;
          border-radius: 2px;
          animation: confettiDrop 1.8s ease-in forwards;
        }
      `}</style>

      <div
        className="min-h-[100dvh] flex flex-col max-w-[480px] mx-auto"
        style={{
          gap: spacingScale.gap,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: '24px',
          paddingBottom: '32px',
          backgroundColor: 'var(--sunday-bg, #FFF8F0)',
          fontFamily: 'var(--sunday-font-body)',
        }}
        onClick={handleFirstInteraction}
        onTouchStart={handleFirstInteraction}
      >
        {/* ── Celebration overlay ── */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="relative w-48 h-48">
              {['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#da77f2'].map((color, i) => (
                <div
                  key={i}
                  className="confetti-piece"
                  style={{
                    backgroundColor: color,
                    left: `${15 + i * 12}%`,
                    top: '30%',
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: `${1.5 + i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <div
              className="text-center"
              style={{
                padding: '24px 32px',
                backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                borderRadius: 'calc(var(--sunday-radius, 12px) * 2.5)',
                boxShadow: 'var(--sunday-shadow-lg)',
                animation: 'celebPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <p className="font-bold m-0" style={{ fontSize: typeScale['2xl'], color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-heading)' }}>
                Enjoy your meal!
              </p>
              <p className="m-0 mt-1" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                Thank you for dining with us
              </p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="text-center">
          <p className="m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
            Order #{order.order_number}
          </p>
          <h1 className="font-bold mt-1 m-0" style={{ fontSize: typeScale['3xl'], color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-heading)' }}>
            {isCancelled
              ? '❌ Order Cancelled'
              : isCompleted
              ? '✅ Enjoy your meal!'
              : isReady
              ? (isTableService ? '🍽️ On its way!' : '🔔 Ready to collect!')
              : 'Order placed!'}
          </h1>
          {!isCancelled && !isCompleted && (
            <p className="mt-1 m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              {isReady
                ? (isTableService ? 'Your food is being brought to your table' : 'Your food is ready — come collect it now')
                : `Kitchen is working on it — usually ready in ~${EST_MINUTES} min`}
            </p>
          )}
        </div>

        {/* ── Notification banner — Android only ── */}
        {!ios && !isCancelled && !isCompleted && !isReady && notifPerm === 'default' && (
          <button onClick={enableNotifications} style={bannerBase}>
            <span className="text-xl shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                wanna know the second your food&apos;s ready?
              </p>
              <p className="mt-0.5 m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                tap to get a ping — even if your phone&apos;s locked
              </p>
            </div>
          </button>
        )}
        {!ios && !isCancelled && !isCompleted && !isReady && notifPerm === 'granted' && (
          <div
            style={{
              ...bannerBase,
              cursor: 'default',
              backgroundColor: 'color-mix(in srgb, var(--sunday-veg, #0F8A00) 8%, var(--sunday-bg, #FFF8F0))',
              borderColor: 'color-mix(in srgb, var(--sunday-veg, #0F8A00) 25%, transparent)',
            }}
          >
            <span className="text-xl shrink-0">✅</span>
            <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
              you&apos;re all set — we&apos;ll let you know when it&apos;s ready!
            </p>
          </div>
        )}

        {/* ── Sound unlock — self service only, push not granted ── */}
        {!ios && !isTableService && !isCancelled && !isCompleted && !isReady && !audioUnlocked && notifPerm !== 'granted' && (
          <button onClick={handleFirstInteraction} style={bannerBase}>
            <span className="text-xl shrink-0">🔊</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                we&apos;ll hit you with a sound when your food&apos;s done cooking
              </p>
              <p className="mt-0.5 m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                just tap here and we&apos;ll handle the rest
              </p>
            </div>
          </button>
        )}

        {/* ── Animated status card ── */}
        {!isCancelled && !isCompleted && (
          <div style={statusCardStyle}>
            {order.status === 'placed' && (
              <>
                <div style={{ fontSize: 48, animation: 'cookingBounce 1.2s ease-in-out infinite', display: 'inline-block' }}>🍳</div>
                <p className="font-semibold m-0" style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                  The kitchen is cooking your order!
                </p>
                <p className="m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                  Estimated wait: ~{EST_MINUTES} min
                </p>
              </>
            )}
            {isReady && !isTableService && (
              <>
                <div style={{ fontSize: 48, animation: 'bellSwing 1s ease-in-out infinite', display: 'inline-block' }}>🔔</div>
                <p className="font-semibold m-0" style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                  Your order is ready!
                </p>
                <p className="m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                  Please come to the counter to collect it
                </p>
              </>
            )}
            {isReady && isTableService && (
              <>
                <div style={{ fontSize: 48, display: 'inline-block' }}>🍽️</div>
                <p className="font-semibold m-0" style={{ fontSize: typeScale.lg, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                  Your order is on its way!
                </p>
                <p className="m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                  Sit tight — your food is being brought to your table
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Progress steps ── */}
        {!isCancelled && (
          <div style={{ ...cardStyle, padding: '16px' }}>
            <div className="flex items-center justify-between relative">
              {/* Track background */}
              <div
                className="absolute"
                style={{ left: '32px', right: '32px', top: '20px', height: '2px', backgroundColor: 'var(--sunday-border, #E8D5B0)' }}
              />
              {/* Track fill — veg/success green signals completion */}
              <div
                className="absolute"
                style={{
                  left: '32px', top: '20px', height: '2px', right: 'auto',
                  backgroundColor: 'var(--sunday-veg, #0F8A00)',
                  width: `${(currentIdx / (STEPS.length - 1)) * 100}%`,
                  transition: 'width 700ms cubic-bezier(0.65, 0, 0.35, 1)',
                }}
              />
              {STEPS.map((step, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="flex flex-col items-center gap-2 z-10 flex-1">
                    <div
                      style={{
                        width: 40, height: 40,
                        borderRadius: '50%',
                        border: '2px solid',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.5s',
                        ...(done
                          ? { backgroundColor: 'var(--sunday-veg, #0F8A00)', borderColor: 'var(--sunday-veg, #0F8A00)', color: '#FFFFFF' }
                          : active
                          ? { backgroundColor: 'var(--sunday-accent, #b12d00)', borderColor: 'var(--sunday-accent, #b12d00)', color: '#FFFFFF', transform: 'scale(1.1)', boxShadow: 'var(--sunday-shadow-md)' }
                          : { backgroundColor: 'var(--sunday-card-bg, #FFFFFF)', borderColor: 'var(--sunday-border, #E8D5B0)', color: 'var(--sunday-border, #E8D5B0)' }
                        ),
                      }}
                    >
                      {done ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                    </div>
                    <span
                      style={{
                        fontSize: typeScale.xs,
                        fontWeight: done || active ? 700 : 400,
                        textAlign: 'center',
                        color: done
                          ? 'var(--sunday-veg, #0F8A00)'
                          : active
                          ? 'var(--sunday-text, #1D1208)'
                          : 'var(--sunday-text-muted, #7A6040)',
                        fontFamily: 'var(--sunday-font-body)',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Order summary ── */}
        <div style={cardStyle} className="overflow-hidden">
          <div
            className="flex justify-between items-center border-b"
            style={{
              paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
              paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
              borderColor: dividerColor,
            }}
          >
            <p className="font-semibold m-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
              Your Items
            </p>
            <span className="font-bold" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
              {formatPrice(total)}
            </span>
          </div>
          <ul className="m-0 p-0 list-none">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-3 border-b last:border-0"
                style={{
                  paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
                  paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
                  borderColor: dividerColor,
                }}
              >
                <div className="flex-1 min-w-0">
                  <span style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                    {item.quantity}× {item.name}
                  </span>
                  {item.notes && (
                    <p className="italic mt-0.5 m-0" style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
                      &ldquo;{item.notes}&rdquo;
                    </p>
                  )}
                </div>
                <span className="font-medium shrink-0" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Order type row ── */}
        <div
          className="flex justify-between"
          style={{
            ...cardStyle,
            paddingLeft: spacingScale.px, paddingRight: spacingScale.px,
            paddingTop: spacingScale.cardPad, paddingBottom: spacingScale.cardPad,
          }}
        >
          <span style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}>
            Order type
          </span>
          <span className="font-medium" style={{ fontSize: typeScale.sm, color: 'var(--sunday-text, #1D1208)', fontFamily: 'var(--sunday-font-body)' }}>
            {order.order_type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
            {order.customer_name && ` · ${order.customer_name}`}
          </span>
        </div>

        <Link
          href={`/${slug}`}
          className="text-center underline underline-offset-2"
          style={{ fontSize: typeScale.sm, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
        >
          Back to menu
        </Link>
      </div>
    </>
  );
}
