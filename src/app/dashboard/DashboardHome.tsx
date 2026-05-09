'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, LayoutGrid, IndianRupee, ShoppingBag, BellRing,
  ChefHat, UtensilsCrossed, ExternalLink,
} from 'lucide-react';
import { useOrders } from '@/contexts/OrdersContext';
import { isActive } from '@/lib/order-status';
import { formatPrice } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import OrderCard from '@/components/shared/OrderCard';
import type { Restaurant, OrderStatus } from '@/types';

interface Props {
  restaurant: Restaurant;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  useEffect(() => {
    prevValue.current = value;
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 400;
    const startTime = performance.now();
    let raf: number;
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={pulse ? 'animate-pulse-once' : ''}>
      {prefix}{display}
    </span>
  );
}

interface YesterdayData {
  orders: number;
  revenue: number;
  topDish: string | null;
}

export default function DashboardHome({ restaurant }: Props) {
  const router = useRouter();
  const { orders } = useOrders();
  const [pendingCalls, setPendingCalls] = useState(0);
  const [yesterday, setYesterday] = useState<YesterdayData | null>(null);
  const [totalTables, setTotalTables] = useState(0);
  const serviceMode = restaurant.service_mode ?? 'self_service';

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayOrders = useMemo(
    () => orders.filter(o => new Date(o.created_at).getTime() >= todayStart),
    [orders, todayStart],
  );

  const activeOrders = useMemo(
    () => todayOrders.filter(o => isActive(o.status as OrderStatus, serviceMode)),
    [todayOrders, serviceMode],
  );

  const activeCount = activeOrders.length;

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of activeOrders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([status, count]) => `${count} ${status}`)
      .join(' · ');
  }, [activeOrders]);

  const occupiedTables = useMemo(() => {
    const tableIds = new Set<string>();
    for (const o of activeOrders) {
      if (o.table_id) tableIds.add(o.table_id);
    }
    return tableIds.size;
  }, [activeOrders]);

  const nonCancelledToday = useMemo(
    () => todayOrders.filter(o => o.status !== 'cancelled'),
    [todayOrders],
  );

  const todayRevenue = useMemo(
    () => nonCancelledToday
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total, 0),
    [nonCancelledToday],
  );

  const paidOrderCount = useMemo(
    () => nonCancelledToday.filter(o => o.payment_status === 'paid').length,
    [nonCancelledToday],
  );

  const todayOrderCount = nonCancelledToday.length;

  const recentOrders = useMemo(
    () => [...todayOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10),
    [todayOrders],
  );

  const fetchTables = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id);
    setTotalTables(count ?? 0);
  }, [restaurant.id]);

  const fetchPendingCalls = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from('waiter_calls')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'pending');
    setPendingCalls(count ?? 0);
  }, [restaurant.id]);

  const fetchYesterday = useCallback(async () => {
    const supabase = createClient();
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const { data: yesterdayOrders } = await supabase
      .from('orders')
      .select('id, total, status, payment_status')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayMidnight.toISOString())
      .neq('status', 'cancelled');

    if (!yesterdayOrders || yesterdayOrders.length === 0) {
      setYesterday(null);
      return;
    }

    const revenue = yesterdayOrders
      .filter((o: Record<string, unknown>) => o.payment_status === 'paid')
      .reduce((s, o) => s + ((o as { total?: number }).total ?? 0), 0);

    const { data: topItems } = await supabase
      .from('order_items')
      .select('name, quantity, order:orders!inner(restaurant_id, created_at, status)')
      .eq('order.restaurant_id', restaurant.id)
      .gte('order.created_at', yesterdayStart.toISOString())
      .lt('order.created_at', todayMidnight.toISOString())
      .neq('order.status', 'cancelled');

    const dishCounts: Record<string, number> = {};
    (topItems ?? []).forEach((item) => {
      dishCounts[item.name] = (dishCounts[item.name] ?? 0) + item.quantity;
    });
    const topDish = Object.entries(dishCounts).sort((a, b) => b[1] - a[1])[0];

    setYesterday({
      orders: yesterdayOrders.length,
      revenue,
      topDish: topDish ? topDish[0] : null,
    });
  }, [restaurant.id]);

  useEffect(() => {
    fetchTables();
    fetchPendingCalls();
    fetchYesterday();
  }, [fetchTables, fetchPendingCalls, fetchYesterday]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-waiter-calls-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchPendingCalls(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant.id, fetchPendingCalls]);

  const yesterdayComparison = yesterday
    ? todayOrderCount - yesterday.orders
    : null;

  const hasOrders = todayOrders.length > 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Good {getGreeting()}
        </h1>
        <p className="text-muted-foreground mt-0.5">{restaurant.name}</p>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Orders */}
        <Link href="/dashboard/orders" className="group">
          <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow h-full">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold">
              {hasOrders ? <AnimatedNumber value={activeCount} /> : <EmptyValue />}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">Active Orders</p>
            {activeCount > 0 && statusBreakdown && (
              <p className="text-xs text-muted-foreground mt-1">{statusBreakdown}</p>
            )}
          </div>
        </Link>

        {/* Tables Occupied */}
        <Link href="/dashboard/floor-plan" className="group">
          <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow h-full">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">
              {totalTables > 0
                ? <><AnimatedNumber value={occupiedTables} /> <span className="text-base font-normal text-muted-foreground">of {totalTables}</span></>
                : <EmptyValue />}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">Tables Occupied</p>
          </div>
        </Link>

        {/* Today's Revenue */}
        <div className="bg-white rounded-xl border p-4 h-full">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mb-3">
            <IndianRupee className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold truncate">
            {hasOrders ? <AnimatedNumber value={todayRevenue} prefix="₹" /> : <EmptyValue />}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Today&apos;s Revenue</p>
          {paidOrderCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{paidOrderCount} paid order{paidOrderCount !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Today's Orders */}
        <div className="bg-white rounded-xl border p-4 h-full">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
            <ShoppingBag className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">
            {hasOrders ? <AnimatedNumber value={todayOrderCount} /> : <EmptyValue />}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Today&apos;s Orders</p>
          {yesterdayComparison !== null && yesterdayComparison !== 0 && (
            <p className={`text-xs mt-1 ${yesterdayComparison > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {yesterdayComparison > 0 ? '+' : ''}{yesterdayComparison} from yesterday
            </p>
          )}
        </div>
      </div>

      {/* Needs Attention */}
      {pendingCalls > 0 && (
        <Link
          href="/dashboard/floor-plan"
          className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <BellRing className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {pendingCalls} pending waiter call{pendingCalls !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700">Tap to view floor plan</p>
          </div>
        </Link>
      )}

      {/* Live Activity Feed */}
      {recentOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Live Activity
            </h2>
            <Link
              href="/dashboard/orders"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                variant="compact"
                onTap={(id) => router.push(`/dashboard/orders`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasOrders && (
        <div className="text-center py-8 bg-white rounded-xl border">
          <ShoppingBag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No orders yet today</p>
          <p className="text-xs text-muted-foreground mt-1">Orders will appear here as they come in</p>
        </div>
      )}

      {/* Yesterday's Snapshot */}
      {yesterday && (
        <p className="text-sm text-muted-foreground px-1">
          Yesterday: {yesterday.orders} order{yesterday.orders !== 1 ? 's' : ''} · {formatPrice(yesterday.revenue)} revenue
          {yesterday.topDish && <> · Top item: {yesterday.topDish}</>}
        </p>
      )}

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <ChefHat className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Kitchen View</p>
            <p className="text-xs text-muted-foreground">Manage live orders</p>
          </div>
        </Link>
        <Link
          href="/dashboard/menu"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Menu</p>
            <p className="text-xs text-muted-foreground">Add or edit dishes</p>
          </div>
        </Link>
        <Link
          href={`/${restaurant.slug}`}
          target="_blank"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <ExternalLink className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Preview Menu</p>
            <p className="text-xs text-muted-foreground">See customer view</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function EmptyValue() {
  return <span className="text-muted-foreground/50">—</span>;
}
