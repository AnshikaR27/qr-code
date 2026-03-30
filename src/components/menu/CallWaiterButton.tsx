'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore cooldown from sessionStorage
  useEffect(() => {
    const until = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (remaining > 0) startCountdown(remaining);

    // Show tooltip on first visit
    if (!localStorage.getItem(TOOLTIP_KEY)) {
      setTimeout(() => {
        setShowTooltip(true);
        localStorage.setItem(TOOLTIP_KEY, '1');
        setTimeout(() => setShowTooltip(false), 3500);
      }, 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      }
    }, 500);
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function handleCall() {
    if (secondsLeft > 0 || loading) return;
    setShowTooltip(false);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('waiter_calls').insert({
        restaurant_id: restaurantId,
        table_id: tableId ?? null,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Waiter has been notified!', { duration: 4000 });
      startCountdown(COOLDOWN_SECONDS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CallWaiter]', msg);
      toast.error(`Could not reach waiter: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const disabled = secondsLeft > 0 || loading;

  // Color scheme: accent bg when idle, surfaceLow when disabled
  const bgColor = disabled ? tokens.surfaceLow : tokens.accent;
  const textColor = disabled ? tokens.textMuted : '#fff';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: cartVisible ? 84 : 24,
        left: 16,
        zIndex: 48,
        transition: 'bottom 0.25s ease',
      }}
    >
      <style>{`
        @keyframes waiterPulse {
          0%, 80%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
          90% { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
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
        .waiter-bell-pulse { animation: bellRing 0.6s ease-in-out; }
      `}</style>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
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
          }}
        >
          Tap to call a waiter 🔔
          <div style={{ position: 'absolute', bottom: -4, left: 16, width: 8, height: 8, backgroundColor: tokens.text, transform: 'rotate(45deg)' }} />
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
          animation: !disabled ? 'waiterPulse 5s ease-in-out infinite' : 'none',
          transition: 'background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease',
        }}
      >
        <Bell
          size={15}
          strokeWidth={2.5}
          style={{
            animation: loading ? 'bellRing 0.5s ease' : 'none',
          }}
        />
        {secondsLeft > 0
          ? `Called (${secondsLeft}s)`
          : loading
          ? 'Calling…'
          : 'Call Waiter'}
      </button>
    </div>
  );
}
