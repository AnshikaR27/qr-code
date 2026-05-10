'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  FileText, Download, ChevronDown, ChevronRight, AlertTriangle, Loader2, Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';
import type { Restaurant, BillingConfig } from '@/types';

interface GSTSummary {
  taxable_sales: number;
  total_tax: number;
  total_cgst: number;
  total_sgst: number;
  service_charge: number;
  gross: number;
  order_count: number;
}

interface RateSummary {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
}

interface DailyRow {
  date: string;
  orders: number;
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
  gross: number;
}

interface DayOrder {
  id: string;
  order_number: number;
  time: string;
  table: string | null;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
}

interface Refund {
  id: string;
  order_number: number;
  date: string;
  original_amount: number;
  tax_amount: number;
  cgst: number;
  sgst: number;
}

interface ReportData {
  summary: GSTSummary;
  rate_summary: RateSummary[];
  daily: DailyRow[];
  day_orders: Record<string, DayOrder[]>;
  refunds: Refund[];
}

type Preset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

function getPresetDates(preset: Preset): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
    case 'yesterday': {
      const y = subDays(today, 1);
      return { from: format(y, 'yyyy-MM-dd'), to: format(y, 'yyyy-MM-dd') };
    }
    case 'last7': {
      return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
    }
    case 'this_month':
      return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(endOfMonth(today), 'yyyy-MM-dd') };
    case 'last_month': {
      const lm = subMonths(today, 1);
      return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') };
    }
    default:
      return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
  }
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function GSTReportClient({ restaurant }: { restaurant: Restaurant }) {
  const config = restaurant.billing_config as BillingConfig | null;
  const hasGstin = !!config?.gstin?.trim();

  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPresetDates(preset);

  const fetchReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/reports/gst?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function handlePreset(p: Preset) {
    setPreset(p);
    if (p !== 'custom') {
      setExpandedDay(null);
    } else if (!customFrom) {
      const d = getPresetDates('this_month');
      setCustomFrom(d.from);
      setCustomTo(d.to);
    }
  }

  async function exportCSV() {
    if (!data) return;
    const header = 'Date,Orders,Taxable Sales,CGST,SGST,Total GST,Gross';
    const rows = data.daily.map(d =>
      `${d.date},${d.orders},${d.taxable.toFixed(2)},${d.cgst.toFixed(2)},${d.sgst.toFixed(2)},${d.tax.toFixed(2)},${d.gross.toFixed(2)}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = restaurant.slug || 'restaurant';
    a.download = `gst-report-${slug}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    if (!data) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const legalName = config?.legal_name?.trim() || restaurant.name;
    doc.text(legalName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (config?.billing_address?.trim()) {
      doc.text(config.billing_address.trim(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (config?.state?.trim()) {
      doc.text(config.state.trim(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const gstinText = hasGstin ? `GSTIN: ${config!.gstin.trim()}` : 'GSTIN: NOT ENTERED';
    doc.text(gstinText, pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(12);
    doc.text(`GST Summary Report`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatDate(from)} to ${formatDate(to)}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Summary table
    const summaryRows = [
      ['Total Taxable Sales', `Rs. ${data.summary.taxable_sales.toFixed(2)}`],
      ['Total CGST', `Rs. ${data.summary.total_cgst.toFixed(2)}`],
      ['Total SGST', `Rs. ${data.summary.total_sgst.toFixed(2)}`],
      ['Total GST Collected', `Rs. ${data.summary.total_tax.toFixed(2)}`],
    ];
    if (data.summary.service_charge > 0) {
      summaryRows.push(['Service Charge (not subject to GST)', `Rs. ${data.summary.service_charge.toFixed(2)}`]);
    }
    summaryRows.push(['Gross Revenue', `Rs. ${data.summary.gross.toFixed(2)}`]);
    summaryRows.push(['Total Orders', String(data.summary.order_count)]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount']],
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 15, right: 15 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Rate breakdown
    if (data.rate_summary.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Tax Rate Breakdown', 15, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['GST Rate', 'Taxable Amount', 'CGST', 'SGST', 'Total GST']],
        body: data.rate_summary.map(r => [
          `${r.rate}%`,
          `Rs. ${r.taxable.toFixed(2)}`,
          `Rs. ${r.cgst.toFixed(2)}`,
          `Rs. ${r.sgst.toFixed(2)}`,
          `Rs. ${r.tax.toFixed(2)}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: 15, right: 15 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Daily breakdown
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Breakdown', 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Orders', 'Taxable Sales', 'CGST', 'SGST', 'Total GST', 'Gross']],
      body: data.daily.map(d => [
        formatDate(d.date),
        String(d.orders),
        `Rs. ${d.taxable.toFixed(2)}`,
        `Rs. ${d.cgst.toFixed(2)}`,
        `Rs. ${d.sgst.toFixed(2)}`,
        `Rs. ${d.tax.toFixed(2)}`,
        `Rs. ${d.gross.toFixed(2)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      margin: { left: 15, right: 15 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Refunds
    if (data.refunds.length > 0) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Refunds for this Period', 15, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Order #', 'Date', 'Original Amount', 'GST on Refund', 'CGST', 'SGST']],
        body: data.refunds.map(r => [
          `#${r.order_number}`,
          formatDate(r.date),
          `Rs. ${r.original_amount.toFixed(2)}`,
          `Rs. ${r.tax_amount.toFixed(2)}`,
          `Rs. ${r.cgst.toFixed(2)}`,
          `Rs. ${r.sgst.toFixed(2)}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
        margin: { left: 15, right: 15 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // Footer
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`HSN/SAC Code: ${config?.sac_code?.trim() || '9963'} (Food and Beverage Service)`, 15, y);
    y += 4;
    doc.text('File as: GSTR-1 (outward supplies) and GSTR-3B (monthly summary)', 15, y);
    y += 4;
    doc.text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 15, y);

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    const slug = restaurant.slug || 'restaurant';
    doc.save(`gst-report-${slug}-${from}-${to}.pdf`);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Tax summary for GSTR-1 / GSTR-3B filing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={!data || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={!data || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* GSTIN Banner */}
      {!hasGstin && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">GSTIN not entered</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Enter your GSTIN in Settings → Tax & Billing to make this report compliance-ready.
            </p>
          </div>
        </div>
      )}

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              preset === p.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">Failed to load report data.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Taxable Sales" value={data.summary.taxable_sales} />
            <SummaryCard label="Total GST" value={data.summary.total_tax} />
            <SummaryCard label="CGST" value={data.summary.total_cgst} />
            <SummaryCard label="SGST" value={data.summary.total_sgst} />
          </div>

          {/* Rate Breakdown */}
          {data.rate_summary.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">By GST Rate</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.rate_summary.map(r => (
                  <Card key={r.rate} size="sm">
                    <CardContent className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500">GST @ {r.rate}%</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taxable</span>
                        <span className="font-medium">{formatPrice(r.taxable)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">CGST @{r.rate / 2}%</span>
                        <span>{formatPrice(r.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">SGST @{r.rate / 2}%</span>
                        <span>{formatPrice(r.sgst)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                        <span>Total GST</span>
                        <span>{formatPrice(r.tax)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Service Charge */}
          {data.summary.service_charge > 0 && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-gray-700">Service Charge Collected</p>
                <p className="text-xs text-gray-500">Not subject to GST</p>
              </div>
              <p className="text-lg font-semibold">{formatPrice(data.summary.service_charge)}</p>
            </div>
          )}

          {/* Gross Revenue */}
          <div className="flex items-center justify-between p-3 bg-gray-900 text-white rounded-lg">
            <div>
              <p className="text-sm font-medium">Gross Revenue</p>
              <p className="text-xs text-gray-400">Taxable + GST + Service Charge</p>
            </div>
            <p className="text-xl font-bold">{formatPrice(data.summary.gross)}</p>
          </div>

          {/* Daily Breakdown Table */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Daily Breakdown</p>

            {/* Desktop table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600"></th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Taxable</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">CGST</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">SGST</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total GST</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No paid orders in this period</td></tr>
                  ) : (
                    data.daily.map(d => (
                      <>
                        <tr
                          key={d.date}
                          onClick={() => setExpandedDay(expandedDay === d.date ? null : d.date)}
                          className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 w-8">
                            {expandedDay === d.date
                              ? <ChevronDown className="w-4 h-4 text-gray-400" />
                              : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </td>
                          <td className="px-4 py-3 font-medium">{formatDate(d.date)}</td>
                          <td className="text-right px-4 py-3">{d.orders}</td>
                          <td className="text-right px-4 py-3">{formatPrice(d.taxable)}</td>
                          <td className="text-right px-4 py-3">{formatPrice(d.cgst)}</td>
                          <td className="text-right px-4 py-3">{formatPrice(d.sgst)}</td>
                          <td className="text-right px-4 py-3 font-medium">{formatPrice(d.tax)}</td>
                          <td className="text-right px-4 py-3 font-medium">{formatPrice(d.gross)}</td>
                        </tr>
                        {expandedDay === d.date && data.day_orders[d.date] && (
                          <tr key={`${d.date}-detail`}>
                            <td colSpan={8} className="bg-gray-50 px-4 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="text-left py-1 px-2">Order #</th>
                                    <th className="text-left py-1 px-2">Time</th>
                                    <th className="text-left py-1 px-2">Table</th>
                                    <th className="text-right py-1 px-2">Taxable</th>
                                    <th className="text-right py-1 px-2">CGST</th>
                                    <th className="text-right py-1 px-2">SGST</th>
                                    <th className="text-right py-1 px-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.day_orders[d.date].map(o => (
                                    <tr key={o.id} className="border-t border-gray-100">
                                      <td className="py-1.5 px-2 font-medium">#{o.order_number}</td>
                                      <td className="py-1.5 px-2">{o.time}</td>
                                      <td className="py-1.5 px-2">{o.table ?? '—'}</td>
                                      <td className="text-right py-1.5 px-2">{formatPrice(o.taxable)}</td>
                                      <td className="text-right py-1.5 px-2">{formatPrice(o.cgst)}</td>
                                      <td className="text-right py-1.5 px-2">{formatPrice(o.sgst)}</td>
                                      <td className="text-right py-1.5 px-2 font-medium">{formatPrice(o.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {data.daily.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No paid orders in this period</p>
              ) : (
                data.daily.map(d => (
                  <div key={d.date} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedDay(expandedDay === d.date ? null : d.date)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="font-medium text-sm">{formatDate(d.date)}</p>
                        <p className="text-xs text-gray-500">{d.orders} order{d.orders !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="text-sm font-semibold">{formatPrice(d.gross)}</p>
                          <p className="text-xs text-gray-500">GST: {formatPrice(d.tax)}</p>
                        </div>
                        {expandedDay === d.date
                          ? <ChevronDown className="w-4 h-4 text-gray-400" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {expandedDay === d.date && data.day_orders[d.date] && (
                      <div className="border-t bg-gray-50 p-3 space-y-2">
                        {data.day_orders[d.date].map(o => (
                          <div key={o.id} className="flex justify-between text-xs">
                            <div>
                              <span className="font-medium">#{o.order_number}</span>
                              <span className="text-gray-500 ml-1">{o.time}</span>
                              {o.table && <span className="text-gray-400 ml-1">· {o.table}</span>}
                            </div>
                            <span className="font-medium">{formatPrice(o.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Refunds Section */}
          {data.refunds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Refunds for this Period</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-red-700">Order #</th>
                      <th className="text-left px-4 py-3 font-semibold text-red-700">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-700">Original Amt</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-700">GST on Refund</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-700">CGST</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-700">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.refunds.map(r => (
                      <tr key={r.id} className="border-b text-red-600">
                        <td className="px-4 py-2.5 font-medium">#{r.order_number}</td>
                        <td className="px-4 py-2.5">{formatDate(r.date)}</td>
                        <td className="text-right px-4 py-2.5">{formatPrice(r.original_amount)}</td>
                        <td className="text-right px-4 py-2.5">{formatPrice(r.tax_amount)}</td>
                        <td className="text-right px-4 py-2.5">{formatPrice(r.cgst)}</td>
                        <td className="text-right px-4 py-2.5">{formatPrice(r.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Refunded orders are excluded from the totals above. Listed here for CA reference.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold mt-1">{formatPrice(value)}</p>
      </CardContent>
    </Card>
  );
}
