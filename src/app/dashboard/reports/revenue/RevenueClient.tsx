'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PeriodToggle, { type Period } from '@/components/reports/PeriodToggle';

interface DailyRow {
  date: string;
  revenue: number;
  orders: number;
  avg_order: number;
}

interface RevenueData {
  total_revenue: number;
  avg_daily: number;
  prev_revenue: number;
  order_count: number;
  days: number;
  daily: DailyRow[];
}

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function formatINR(n: number) {
  return `₹${fmt.format(Math.round(n))}`;
}

function formatAxisTick(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
}

function formatDateLabel(dateStr: string, period: Period) {
  const [, m, d] = dateStr.split('-');
  const date = new Date(dateStr + 'T12:00:00+05:30');
  if (period === '7d') {
    const day = date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    return `${day} ${parseInt(d)}`;
  }
  const month = date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
  return `${month} ${parseInt(d)}`;
}

function formatFullDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function RevenueClient() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : 30;
      const res = await fetch(`/api/owner/reports/revenue?days=${days}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pctChange = data && data.prev_revenue > 0
    ? ((data.total_revenue - data.prev_revenue) / data.prev_revenue) * 100
    : null;

  const chartData = data?.daily.map(d => ({
    ...d,
    label: formatDateLabel(d.date, period),
  })) ?? [];

  const sortedDaily = data
    ? [...data.daily].sort((a, b) => sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
    : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Trend</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily revenue over time</p>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">Failed to load report data.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-xl font-bold mt-1">{formatINR(data.total_revenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{data.order_count} order{data.order_count !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground font-medium">Avg Daily Revenue</p>
                <p className="text-xl font-bold mt-1">{formatINR(data.avg_daily)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">over {data.days} days</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground font-medium">vs Previous {data.days} Days</p>
                {pctChange !== null ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    {pctChange > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : pctChange < 0 ? (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    ) : (
                      <Minus className="w-5 h-5 text-gray-400" />
                    )}
                    <span className={cn(
                      'text-xl font-bold',
                      pctChange > 0 ? 'text-green-600' : pctChange < 0 ? 'text-red-500' : 'text-gray-600',
                    )}>
                      {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <p className="text-xl font-bold mt-1 text-gray-400">&mdash;</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.prev_revenue > 0 ? `prev: ${formatINR(data.prev_revenue)}` : 'no previous data'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Chart */}
          <Card>
            <CardContent className="pt-4">
              {data.total_revenue === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
                  No revenue in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#888' }}
                      interval={period === '30d' ? 4 : 0}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e5e5' }}
                    />
                    <YAxis
                      tickFormatter={formatAxisTick}
                      tick={{ fontSize: 11, fill: '#888' }}
                      tickLine={false}
                      axisLine={false}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value) => [formatINR(Number(value)), 'Revenue']}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload as DailyRow | undefined;
                        return row ? `${String(label)} — ${row.orders} order${row.orders !== 1 ? 's' : ''}` : String(label);
                      }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={{ r: period === '7d' ? 4 : 2, fill: '#111827' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Daily Breakdown</p>
              <button
                onClick={() => setSortDesc(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {sortDesc ? 'Newest first ↓' : 'Oldest first ↑'}
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Avg Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDaily.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">No data</td></tr>
                  ) : sortedDaily.map(d => (
                    <tr key={d.date} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{formatFullDate(d.date)}</td>
                      <td className="text-right px-4 py-3">{d.orders}</td>
                      <td className="text-right px-4 py-3">{formatINR(d.revenue)}</td>
                      <td className="text-right px-4 py-3">{d.orders > 0 ? formatINR(d.avg_order) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {sortedDaily.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No data</p>
              ) : sortedDaily.map(d => (
                <div key={d.date} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{formatFullDate(d.date)}</p>
                    <p className="text-xs text-gray-500">{d.orders} order{d.orders !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatINR(d.revenue)}</p>
                    {d.orders > 0 && (
                      <p className="text-xs text-gray-500">avg {formatINR(d.avg_order)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
