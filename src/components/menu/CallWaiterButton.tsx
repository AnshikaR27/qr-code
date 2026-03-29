'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { MenuTokens } from '@/lib/tokens';

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = 'waiter-call-cooldown-until';

interface Props {
  restaurantId: string;
  tableId: string | null;
  tokens: MenuTokens;
  cartVisible: boolean; // shift up when cart bar is showing
}

export default function CallWaiterButton({ restaurantId, tableId, tokens, cartVisible }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore cooldown from sessionStorage so refresh doesn't reset it
  useEffect(() => {
    const until = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (remaining > 0) startCountdown(remaining);
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
    } catch {
      toast.error('Could not reach waiter. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const disabled = secondsLeft > 0 || loading;

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
      <button
        onClick={handleCall}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 14px',
          borderRadius: 9999,
          border: `1.5px solid ${tokens.border}`,
          backgroundColor: disabled ? tokens.surfaceLow : tokens.cardBg,
          color: disabled ? tokens.textMuted : tokens.text,
          fontFamily: tokens.fontBody,
          fontSize: 12,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          boxShadow: disabled ? 'none' : `0 2px 12px rgba(0,0,0,0.1)`,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Bell
          size={14}
          strokeWidth={2}
          style={{
            animation: loading ? 'bellShake 0.4s ease' : 'none',
          }}
        />
        {secondsLeft > 0
          ? `Called (${secondsLeft}s)`
          : loading
          ? 'Calling…'
          : 'Call Waiter'}
      </button>

      <style>{`
        @keyframes bellShake {
          0%,100% { transform: rotate(0); }
          25%      { transform: rotate(-15deg); }
          75%      { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
