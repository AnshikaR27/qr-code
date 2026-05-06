'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { getTrackedOrders, type TrackedOrder } from '@/lib/tracked-orders';
import type { OrderStatus } from '@/types';

const SIZE = 56;
const MARGIN = 12;
const SNAP_DURATION = 200;
const TAP_THRESHOLD = 6;
const LS_KEY_PREFIX = 'sunday:floating-order-pos:';

interface SavedPos { x: number; y: number; edge: 'left' | 'right' }

function clampPos(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth - SIZE - MARGIN;
  const maxY = window.innerHeight - SIZE - MARGIN;
  return {
    x: Math.min(Math.max(x, MARGIN), maxX),
    y: Math.min(Math.max(y, MARGIN), maxY),
  };
}

function defaultPos(): { x: number; y: number } {
  return clampPos(
    window.innerWidth - SIZE - MARGIN,
    window.innerHeight - SIZE - MARGIN - 80,
  );
}

function getAggregateStatus(orders: TrackedOrder[]): OrderStatus | null {
  if (orders.some(o => o.status === 'ready')) return 'ready';
  if (orders.some(o => o.status === 'placed')) return 'placed';
  return null;
}

function statusDotColor(status: OrderStatus | null): string {
  if (status === 'ready') return 'var(--sunday-veg, #16a34a)';
  if (status === 'placed') return 'var(--sunday-accent, #d97706)';
  return 'var(--sunday-text-muted, #9ca3af)';
}

interface Props {
  slug: string;
  onTap: () => void;
  refreshKey?: number;
}

export default function FloatingOrderStatus({ slug, onTap, refreshKey }: Props) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);

  useEffect(() => {
    setOrders(getTrackedOrders().filter(o => o.status !== 'delivered' && o.status !== 'cancelled'));
  }, [refreshKey]);

  const count = orders.length;
  const aggStatus = getAggregateStatus(orders);

  const lsKey = LS_KEY_PREFIX + slug;
  const btnRef = useRef<HTMLButtonElement>(null);

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const dragging = useRef(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const saved: SavedPos = JSON.parse(raw);
        setPos(clampPos(saved.x, saved.y));
        setReady(true);
        return;
      }
    } catch { /* ignore */ }
    setPos(defaultPos());
    setReady(true);
  }, [lsKey]);

  useEffect(() => {
    function handleResize() {
      if (dragging.current) return;
      setPos(prev => clampPos(prev.x, prev.y));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const savePos = useCallback((x: number, y: number, edge: 'left' | 'right') => {
    try { localStorage.setItem(lsKey, JSON.stringify({ x, y, edge })); } catch { /* ignore */ }
  }, [lsKey]);

  const snapToEdge = useCallback((cx: number, cy: number) => {
    const vw = window.innerWidth;
    const nearLeft = cx + SIZE / 2 < vw / 2;
    const snapX = nearLeft ? MARGIN : vw - SIZE - MARGIN;
    const final = clampPos(snapX, cy);
    setSnapping(true);
    setPos(final);
    savePos(final.x, final.y, nearLeft ? 'left' : 'right');
    setTimeout(() => setSnapping(false), SNAP_DURATION);
  }, [savePos]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...posRef.current };
    setSnapping(false);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    if (!moved.current && Math.abs(dx) + Math.abs(dy) > TAP_THRESHOLD) {
      moved.current = true;
    }
    if (moved.current) {
      setPos(clampPos(startPos.current.x + dx, startPos.current.y + dy));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragging.current = false;
    if (moved.current) {
      snapToEdge(posRef.current.x, posRef.current.y);
    } else {
      onTap();
    }
  }, [snapToEdge, onTap]);

  if (count === 0 || !ready) return null;

  const dotColor = statusDotColor(aggStatus);
  const isPulsing = aggStatus === 'ready';

  return (
    <button
      ref={btnRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      aria-label={`${count} active order${count !== 1 ? 's' : ''}`}
      className="fixed z-50 flex items-center justify-center rounded-full border-none cursor-grab active:cursor-grabbing"
      style={{
        width: SIZE,
        height: SIZE,
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transition: snapping ? `transform ${SNAP_DURATION}ms ease-out` : 'none',
        backgroundColor: 'var(--sunday-primary, #361f1a)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
    >
      <Bell size={24} color="#FFFFFF" />

      {/* Badge */}
      <span
        className="absolute flex items-center justify-center rounded-full font-bold"
        style={{
          top: -2,
          right: -2,
          minWidth: 20,
          height: 20,
          padding: '0 5px',
          fontSize: 11,
          backgroundColor: 'var(--sunday-accent, #b12d00)',
          color: '#FFFFFF',
          lineHeight: 1,
        }}
      >
        {count}
      </span>

      {/* Status dot */}
      <span
        className="absolute rounded-full"
        style={{
          bottom: 2,
          right: 2,
          width: 10,
          height: 10,
          backgroundColor: dotColor,
          border: '2px solid var(--sunday-primary, #361f1a)',
          animation: isPulsing ? 'floatingDotPulse 1.5s ease-in-out infinite' : 'none',
        }}
      />

      <style>{`
        @keyframes floatingDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </button>
  );
}
