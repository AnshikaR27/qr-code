'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { startReadyChimeLoop, stopReadyChimeLoop, playPreparingChime, unlockCustomerAudio } from '@/lib/customer-chime';
import type { Order, OrderItem, OrderStatus } from '@/types';

// Convert VAPID public key from base64 URL to Uint8Array for pushManager.subscribe
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

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'placed',    label: 'Order Placed', icon: Clock        },
  { status: 'ready',     label: 'Ready!',       icon: PackageCheck },
  { status: 'delivered', label: 'Enjoy!',       icon: CheckCircle2 },
];

function statusIndex(s: OrderStatus) {
  const idx = STEPS.findIndex((step) => step.status === s);
  return idx === -1 ? STEPS.length : idx;
}

// Estimated prep time in minutes (stored so it persists across renders)
const EST_MINUTES = 15;

export default function OrderStatusPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prevStatus, setPrevStatus] = useState<OrderStatus | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [notifPerm, setNotifPerm] = useState<'default' | 'granted' | 'denied'>('default');
  const audioUnlockedRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Unlock audio on first tap, and stop the ready chime loop if it's ringing
  const handleFirstInteraction = useCallback(() => {
    stopReadyChimeLoop();
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    unlockCustomerAudio().catch(() => {});
  }, []);

  // Check notification permission on mount (don't auto-request — needs user gesture on mobile)
  // If already granted, auto-subscribe to Web Push
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPerm(Notification.permission as 'default' | 'granted' | 'denied');
      if (Notification.permission === 'granted') {
        subscribeToPush();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    // Also unlock audio from this user gesture
    handleFirstInteraction();
    const perm = await Notification.requestPermission();
    setNotifPerm(perm as 'default' | 'granted' | 'denied');

    // Subscribe to Web Push if permission granted
    if (perm === 'granted') {
      subscribeToPush();
    }
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
      // Push not supported or blocked — fall back to chime silently
      console.warn('[push] subscription failed:', err);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    async function fetchOrder() {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', orderId)
        .single();

      if (err || !data) {
        setError('Order not found');
        setLoading(false);
        return;
      }

      setOrder(data as Order);
      setItems((data.items ?? []) as OrderItem[]);
      setPrevStatus((data as Order).status);
      setLoading(false);
    }

    fetchOrder();

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

            // ── Notifications on status change ──
            if (newStatus && newStatus !== prev) {
              if (newStatus === 'ready') {
                startReadyChimeLoop();
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate([400, 150, 400, 150, 400]);
                }
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                  new Notification('Your order is ready! \uD83D\uDD14', {
                    body: `Order #${(payload.new as Partial<Order>).order_number ?? ''} — please collect from the counter.`,
                    icon: '/favicon.ico',
                  });
                }
              } else if (newStatus === 'preparing') {
                playPreparingChime();
              }
            }

            return newStatus ?? prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopReadyChimeLoop();
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4">
        <p className="text-muted-foreground">{error || 'Order not found'}</p>
        <Link href={`/${slug}`} className="text-sm underline">Back to menu</Link>
      </div>
    );
  }

  const currentIdx = statusIndex(order.status);
  const isCompleted = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isReady     = order.status === 'ready';
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

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

      <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto px-4 py-6 gap-5" onClick={handleFirstInteraction} onTouchStart={handleFirstInteraction}>
        {/* ── Celebration overlay ── */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
            {/* Confetti burst */}
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
              className="text-center px-8 py-6 bg-white rounded-3xl shadow-2xl"
              style={{ animation: 'celebPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <div className="text-6xl mb-3">🎉</div>
              <p className="text-xl font-bold text-gray-900">Enjoy your meal!</p>
              <p className="text-sm text-gray-500 mt-1">Thank you for dining with us</p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
          <h1 className="text-2xl font-bold mt-1">
            {isCancelled
              ? '❌ Order Cancelled'
              : isCompleted
              ? '✅ Enjoy your meal!'
              : isReady
              ? '🔔 Ready to collect!'
              : 'Order placed!'}
          </h1>
          {!isCancelled && !isCompleted && (
            <p className="text-sm text-muted-foreground mt-1">
              {isReady
                ? 'Your food is ready — come collect it now'
                : `Kitchen is working on it — usually ready in ~${EST_MINUTES} min`}
            </p>
          )}
        </div>

        {/* ── Notification banner — Android only (iOS blocks Web Push) ── */}
        {!isIOS() && !isCancelled && !isCompleted && !isReady && notifPerm === 'default' && (
          <button
            onClick={enableNotifications}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-left transition-colors active:bg-blue-100"
          >
            <span className="text-xl flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-800">wanna know the second your food&apos;s ready?</p>
              <p className="text-xs text-blue-600 mt-0.5">tap to get a ping — even if your phone&apos;s locked</p>
            </div>
          </button>
        )}
        {!isIOS() && !isCancelled && !isCompleted && !isReady && notifPerm === 'granted' && (
          <div className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
            <span className="text-xl flex-shrink-0">✅</span>
            <p className="text-sm font-semibold text-green-800">you&apos;re all set — we&apos;ll let you know when it&apos;s ready!</p>
          </div>
        )}

        {/* ── Sound unlock prompt ── */}
        {!isCancelled && !isCompleted && !isReady && !audioUnlocked && (
          <button
            onClick={handleFirstInteraction}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left transition-colors active:bg-gray-100"
          >
            <span className="text-xl flex-shrink-0">🔊</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">we&apos;ll hit you with a sound when your food&apos;s done cooking</p>
              <p className="text-xs text-gray-500 mt-0.5">just tap here and we&apos;ll handle the rest</p>
            </div>
          </button>
        )}

        {/* ── Animated status card ── */}
        {!isCancelled && !isCompleted && (
          <div className={cn(
            'rounded-2xl border p-5 flex flex-col items-center gap-3 text-center transition-colors',
            order.status === 'placed' && 'bg-amber-50 border-amber-200',
            isReady && 'bg-green-50 border-green-300',
          )}>
            {order.status === 'placed' && (
              <>
                <div style={{ fontSize: 48, animation: 'cookingBounce 1.2s ease-in-out infinite', display: 'inline-block' }}>
                  🍳
                </div>
                <p className="font-semibold text-amber-800">The kitchen is cooking your order!</p>
                <p className="text-xs text-amber-600">Estimated wait: ~{EST_MINUTES} min</p>
              </>
            )}
            {isReady && (
              <>
                <div style={{ fontSize: 48, animation: 'bellSwing 1s ease-in-out infinite', display: 'inline-block' }}>
                  🔔
                </div>
                <p className="font-semibold text-green-800 text-lg">Your order is ready!</p>
                <p className="text-xs text-green-600">Please come to the counter to collect it</p>
              </>
            )}
          </div>
        )}

        {/* ── Progress steps ── */}
        {!isCancelled && (
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-8" />
              <div
                className="absolute left-0 top-5 h-0.5 bg-green-500 mx-8 transition-all duration-700"
                style={{ width: `${(currentIdx / (STEPS.length - 1)) * 100}%`, right: 'auto' }}
              />
              {STEPS.map((step, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="flex flex-col items-center gap-2 z-10 flex-1">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500',
                        done || active
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-200 text-gray-300',
                        active && 'scale-110 shadow-md shadow-green-200',
                      )}
                    >
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={cn(
                      'text-xs font-medium text-center',
                      done || active ? 'text-green-700 font-bold' : 'text-gray-400'
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Order summary ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex justify-between items-center">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your Items
            </p>
            <span className="text-sm font-bold">{formatPrice(total)}</span>
          </div>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-2.5 flex justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.quantity}× {item.name}</span>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">&ldquo;{item.notes}&rdquo;</p>
                  )}
                </div>
                <span className="text-sm font-medium flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Order type ── */}
        <div className="bg-white rounded-xl border px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Order type</span>
          <span className="font-medium">
            {order.order_type === 'dine_in' ? '🪑 Dine In' : '🛍️ Parcel'}
            {order.customer_name && ` · ${order.customer_name}`}
          </span>
        </div>

        <Link
          href={`/${slug}`}
          className="text-center text-sm text-muted-foreground underline underline-offset-2"
        >
          Back to menu
        </Link>
      </div>
    </>
  );
}
