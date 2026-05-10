'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PeriodToggle, { type Period } from '@/components/reports/PeriodToggle';

interface ItemRow {
  name: string;
  category: string | null;
  quantity: number;
  revenue: number;
  avg_price: number;
}

interface TopItemsData {
  total_quantity: number;
  unique_items: number;
  items: ItemRow[];
}

type SortKey = 'quantity' | 'revenue' | 'name';

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
function formatINR(n: number) { return `₹${fmt.format(Math.round(n))}`; }

const PAGE_SIZE = 25;

export default function TopItemsClient() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<TopItemsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('quantity');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : 30;
      const res = await fetch(`/api/owner/reports/top-items?days=${days}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      setPage(0);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top10 = useMemo(() => (data?.items ?? []).slice(0, 10), [data]);

  const sortedItems = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = a[sortKey] - b[sortKey];
      return sortAsc ? cmp : -cmp;
    });
  }, [data, sortKey, sortAsc]);

  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE);
  const pageItems = sortedItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const globalOffset = page * PAGE_SIZE;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortAsc ? ' ↑' : ' ↓';
  }

  const barColors = [
    '#111827', '#1f2937', '#374151', '#4b5563', '#6b7280',
    '#9ca3af', '#9ca3af', '#d1d5db', '#d1d5db', '#e5e7eb',
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Items</h1>
          <p className="text-sm text-muted-foreground mt-1">Best-selling menu items by quantity</p>
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
          <div className="grid grid-cols-2 gap-3">
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground font-medium">Total Items Sold</p>
                <p className="text-xl font-bold mt-1">{fmt.format(data.total_quantity)}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground font-medium">Unique Items</p>
                <p className="text-xl font-bold mt-1">{data.unique_items}</p>
              </CardContent>
            </Card>
          </div>

          {/* Horizontal Bar Chart — Top 10 */}
          {top10.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Top 10</p>
                <ResponsiveContainer width="100%" height={Math.max(top10.length * 40 + 20, 200)}>
                  <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#374151' }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value, _, props) => {
                        const row = props?.payload as ItemRow | undefined;
                        return [`${Number(value)} sold — ${formatINR(row?.revenue ?? 0)}`, 'Quantity'];
                      }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                    />
                    <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {top10.map((_, i) => (
                        <Cell key={i} fill={barColors[i] ?? '#e5e7eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg flex items-center justify-center py-16 text-gray-400 text-sm">
              No items sold in this period
            </div>
          )}

          {/* Full Table */}
          {sortedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">All Items</p>

              {/* Desktop table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">#</th>
                      <th
                        className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('name')}
                      >
                        Item{sortIndicator('name')}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                      <th
                        className="text-right px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('quantity')}
                      >
                        Qty Sold{sortIndicator('quantity')}
                      </th>
                      <th
                        className="text-right px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('revenue')}
                      >
                        Revenue{sortIndicator('revenue')}
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item, i) => (
                      <tr key={item.name} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400">{globalOffset + i + 1}</td>
                        <td className="px-4 py-2.5 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{item.category ?? '—'}</td>
                        <td className="text-right px-4 py-2.5">{item.quantity}</td>
                        <td className="text-right px-4 py-2.5">{formatINR(item.revenue)}</td>
                        <td className="text-right px-4 py-2.5">{formatINR(item.avg_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {pageItems.map((item, i) => (
                  <div key={item.name} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          <span className="text-gray-400 mr-1">#{globalOffset + i + 1}</span>
                          {item.name}
                        </p>
                        {item.category && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{item.quantity} sold</p>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Revenue: {formatINR(item.revenue)}</span>
                      <span>Avg: {formatINR(item.avg_price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-md border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-md border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
