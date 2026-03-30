'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { MenuTokens } from '@/lib/tokens';

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = 'waiter-call-cooldown-until';
const TOOLTIP_KEY = 'waiter-tooltip-seen';

interface Props {
  restaurantId: string;
  tableId: string | null;
  tokens: MenuTokens;
  cartVisible: boolean;
}

export default function CallWaiterButton({ restaurantId, tableId, tokens, cartVisible }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'pending' | 'acknowledged'>('idle');
  const [showBanner, setShowBanner] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stores a cleanup fn that calls supabase.removeChannel on the right client instance
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Restore cooldown from sessionStorage on mount
  useEffect(() => {
    const until = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (remaining > 0) startCountdown(remaining);

    if (!localStorage.getItem(TOOLTIP_KEY)) {
      setTimeout(() => {
        setShowTooltip(true);
        localStorage.setItem(TOOLTIP_KEY, '1');
        setTimeout(() => setShowTooltip(false), 3500);
      }, 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      unsubscribeRef.current?.();
    };
  }, []);

  function startCountdown(from: number) {
    setSecondsLeft(from);
    const until = Date.now() + from * 1000;
    sessionStorage.setItem(STORAGE_KEY, String(until));

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        sessionStorage.removeItem(STORAGE_KEY);
        // If still pending when timer expires, give up waiting and reset
        setCallStatus((s) => (s === 'pending' ? 'idle' : s));
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      }
    }, 500);
  }

  function stopCountdown() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function subscribeToCall(callId: string) {
    const supabase = createClient();
    const channel = supabase
      .channel(`waiter-call-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'waiter_calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          if ((payload.new as { status: string }).status === 'acknowledged') {
            handleAcknowledged(supabase, channel);
          }
        }
      )
      .subscribe();

    // Store cleanup so unmount and timer-expiry can remove it
    unsubscribeRef.current = () => supabase.removeChannel(channel);
  }

  function handleAcknowledged(
    supabase: ReturnType<typeof createClient>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel: any
  ) {
    stopCountdown();
    setCallStatus('acknowledged');
    setShowBanner(true);

    // Unsubscribe now that we got the response
    supabase.removeChannel(channel);
    unsubscribeRef.current = null;

    // Auto-dismiss banner and reset button after 5 s
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setShowBanner(false);
      setCallStatus('idle');
    }, 5000);
  }

  async function handleCall() {
    if (loading || callStatus === 'pending') return;
    setShowTooltip(false);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('waiter_calls')
        .insert({
          restaurant_id: restaurantId,
          table_id: tableId ?? null,
          status: 'pending',
        })
        .select('id')
        .single();
      if (error) throw error;

      setCallStatus('pending');
      startCountdown(COOLDOWN_SECONDS);
      subscribeToCall(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CallWaiter]', msg);
      toast.error(`Could not reach waiter: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const isPending = callStatus === 'pending';
  const disabled = loading || isPending;

  const bgColor = isPending
    ? tokens.primary
    : secondsLeft > 0
    ? tokens.surfaceLow
    : tokens.accent;
  const textColor = isPending || secondsLeft === 0 ? '#fff' : tokens.textMuted;

  return (
    <>
      <style>{`
        @keyframes waiterPulse {
          0%, 80%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
          90%            { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
        }
        @keyframes pendingPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bellRing {
          0%, 100% { transform: rotate(0); }
          15%       { transform: rotate(-20deg); }
          30%       { transform: rotate(20deg); }
          45%       { transform: rotate(-15deg); }
          60%       { transform: rotate(15deg); }
          75%       { transform: rotate(-8deg); }
        }
        @keyframes bannerSlideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* ── Acknowledged banner ── */}
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            backgroundColor: tokens.success,
            color: '#fff',
            fontFamily: tokens.fontBody,
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 16,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            maxWidth: 340,
            width: 'calc(100vw - 32px)',
            animation: 'bannerSlideDown 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span>A waiter is on the way to your table!</span>
        </div>
      )}

      {/* ── Button + sub-text wrapper ── */}
      <div
        style={{
          position: 'fixed',
          bottom: cartVisible ? 84 : 24,
          left: 16,
          zIndex: 48,
          transition: 'bottom 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
        }}
      >
        {/* Tooltip (first-visit) */}
        {showTooltip && (
          <div
            style={{
              backgroundColor: tokens.text,
              color: tokens.bg,
              fontFamily: tokens.fontBody,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              padding: '6px 10px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              animation: 'tooltipFadeIn 0.25s ease both',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            Tap to call a waiter 🔔
            <div
              style={{
                position: 'absolute', bottom: -4, left: 16,
                width: 8, height: 8,
                backgroundColor: tokens.text,
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        )}

        <button
          onClick={handleCall}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '11px 18px',
            borderRadius: 9999,
            border: 'none',
            backgroundColor: bgColor,
            color: textColor,
            fontFamily: tokens.fontBody,
            fontSize: 13,
            fontWeight: 700,
            cursor: disabled ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            opacity: loading ? 0.7 : 1,
            animation: isPending
              ? 'pendingPulse 1.6s ease-in-out infinite'
              : !disabled && secondsLeft === 0
              ? 'waiterPulse 5s ease-in-out infinite'
              : 'none',
            transition: 'background-color 0.25s ease, color 0.2s ease, opacity 0.2s ease',
          }}
        >
          <Bell
            size={15}
            strokeWidth={2.5}
            style={{ animation: loading ? 'bellRing 0.5s ease' : 'none' }}
          />
          {loading
            ? 'Calling…'
            : isPending
            ? 'Calling...'
            : secondsLeft > 0
            ? `Called (${secondsLeft}s)`
            : 'Call Waiter'}
        </button>

        {/* Sub-text while waiting for response */}
        {isPending && !loading && (
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              paddingLeft: 8,
              animation: 'pendingPulse 1.6s ease-in-out infinite',
            }}
          >
            Waiting for response…
          </div>
        )}
      </div>
    </>
  );
}
