import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ShoppingBag, TrendingUp, Clock, Star } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch today's orders
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, total, status')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', today.toISOString())
    .neq('status', 'cancelled');

  const orders = todayOrders ?? [];
  const totalOrders = orders.length;
  const revenue = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const activeOrders = orders.filter(
    (o) => o.status === 'placed' || o.status === 'preparing'
  ).length;

  // Most ordered dish today
  const { data: topItems } = await supabase
    .from('order_items')
    .select('name, quantity, order:orders!inner(restaurant_id, created_at, status)')
    .eq('order.restaurant_id', restaurant.id)
    .gte('order.created_at', today.toISOString())
    .neq('order.status', 'cancelled');

  // Aggregate by name
  const dishCounts: Record<string, number> = {};
  (topItems ?? []).forEach((item) => {
    dishCounts[item.name] = (dishCounts[item.name] ?? 0) + item.quantity;
  });
  const topDish = Object.entries(dishCounts).sort((a, b) => b[1] - a[1])[0];

  const stats = [
    {
      label: 'Orders Today',
      value: totalOrders,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/dashboard/orders',
    },
    {
      label: 'Revenue Today',
      value: formatPrice(revenue),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Active Orders',
      value: activeOrders,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/dashboard/orders',
    },
    {
      label: 'Top Dish Today',
      value: topDish ? `${topDish[0]} (×${topDish[1]})` : '—',
      icon: Star,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Good {getGreeting()}, 👋</h1>
        <p className="text-muted-foreground mt-0.5">{restaurant.name} · Today's overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => {
          const card = (
            <div className="bg-white rounded-xl border p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold truncate">{value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Kitchen View</p>
            <p className="text-xs text-muted-foreground">Manage live orders</p>
          </div>
        </Link>
        <Link
          href="/dashboard/menu"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <Star className="w-5 h-5 text-muted-foreground" />
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
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Preview Menu</p>
            <p className="text-xs text-muted-foreground">See customer view</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
