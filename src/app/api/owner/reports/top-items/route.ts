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

  function istDate(daysAgo: number) {
    const d = new Date(istNow.getTime() - daysAgo * 86400000);
    return d.toISOString().slice(0, 10);
  }

  const fromDate = `${istDate(days - 1)}T00:00:00+05:30`;
  const toDate = `${istDate(0)}T23:59:59.999+05:30`;

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('payment_status', 'paid')
    .gte('created_at', fromDate)
    .lte('created_at', toDate);

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const orderIds = (orders ?? []).map(o => o.id);
  if (orderIds.length === 0) {
    return NextResponse.json({
      total_quantity: 0,
      unique_items: 0,
      items: [],
    });
  }

  const batchSize = 100;
  const allItems: { name: string; price: number; quantity: number; category_name: string | null; status: string }[] = [];

  for (let i = 0; i < orderIds.length; i += batchSize) {
    const batch = orderIds.slice(i, i + batchSize);
    const { data: items, error: itemError } = await supabase
      .from('order_items')
      .select('name, price, quantity, category_name, status')
      .in('order_id', batch);

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    if (items) allItems.push(...items);
  }

  const activeItems = allItems.filter(i => i.status === 'active');

  const itemMap = new Map<string, { name: string; category: string | null; quantity: number; revenue: number; prices: number[] }>();

  for (const item of activeItems) {
    const key = item.name;
    const existing = itemMap.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      existing.prices.push(item.price);
    } else {
      itemMap.set(key, {
        name: item.name,
        category: item.category_name,
        quantity: item.quantity,
        revenue: item.price * item.quantity,
        prices: [item.price],
      });
    }
  }

  const items = Array.from(itemMap.values())
    .map(i => ({
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      revenue: Math.round(i.revenue * 100) / 100,
      avg_price: Math.round((i.revenue / i.quantity) * 100) / 100,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

  return NextResponse.json({
    total_quantity: totalQuantity,
    unique_items: items.length,
    items,
  });
}
