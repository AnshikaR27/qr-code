import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant' }, { status: 404 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') ?? '7', 10);
  if (![7, 30].includes(days)) {
    return NextResponse.json({ error: 'days must be 7 or 30' }, { status: 400 });
  }

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const istToday = istNow.toISOString().slice(0, 10);

  function istDate(daysAgo: number) {
    const d = new Date(istNow.getTime() - daysAgo * 86400000);
    return d.toISOString().slice(0, 10);
  }

  const currentFrom = istDate(days - 1);
  const currentTo = istToday;
  const prevFrom = istDate(days * 2 - 1);
  const prevTo = istDate(days);

  const currentFromTs = `${currentFrom}T00:00:00+05:30`;
  const currentToTs = `${currentTo}T23:59:59.999+05:30`;
  const prevFromTs = `${prevFrom}T00:00:00+05:30`;
  const prevToTs = `${prevTo}T23:59:59.999+05:30`;

  const [currentRes, prevRes] = await Promise.all([
    supabase
      .from('orders')
      .select('created_at, grand_total')
      .eq('restaurant_id', restaurant.id)
      .eq('payment_status', 'paid')
      .not('grand_total', 'is', null)
      .gte('created_at', currentFromTs)
      .lte('created_at', currentToTs),
    supabase
      .from('orders')
      .select('grand_total')
      .eq('restaurant_id', restaurant.id)
      .eq('payment_status', 'paid')
      .not('grand_total', 'is', null)
      .gte('created_at', prevFromTs)
      .lte('created_at', prevToTs),
  ]);

  if (currentRes.error) return NextResponse.json({ error: currentRes.error.message }, { status: 500 });

  const currentOrders = currentRes.data ?? [];
  const prevOrders = prevRes.data ?? [];

  const totalRevenue = currentOrders.reduce((s, o) => s + (o.grand_total ?? 0), 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + (o.grand_total ?? 0), 0);

  const dailyMap = new Map<string, { revenue: number; orders: number }>();

  for (let i = days - 1; i >= 0; i--) {
    const d = istDate(i);
    dailyMap.set(d, { revenue: 0, orders: 0 });
  }

  for (const o of currentOrders) {
    const d = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const entry = dailyMap.get(d);
    if (entry) {
      entry.revenue += o.grand_total ?? 0;
      entry.orders += 1;
    }
  }

  const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders,
    avg_order: v.orders > 0 ? Math.round((v.revenue / v.orders) * 100) / 100 : 0,
  }));

  return NextResponse.json({
    total_revenue: Math.round(totalRevenue * 100) / 100,
    avg_daily: Math.round((totalRevenue / days) * 100) / 100,
    prev_revenue: Math.round(prevRevenue * 100) / 100,
    order_count: currentOrders.length,
    days,
    daily,
  });
}
