import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, billing_config')
    .eq('owner_id', user.id)
    .single();
  if (!restaurant) return NextResponse.json({ error: 'No restaurant' }, { status: 404 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 });

  const fromDate = `${from}T00:00:00+05:30`;
  const toDate = `${to}T23:59:59.999+05:30`;

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at, payment_status, subtotal, tax_amount, cgst_amount, sgst_amount, gst_rate_snapshot, service_charge_amount, grand_total, table:tables(table_number, display_name)')
    .eq('restaurant_id', restaurant.id)
    .in('payment_status', ['paid', 'refunded'])
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .not('subtotal', 'is', null)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paidOrders = (orders ?? []).filter(o => o.payment_status === 'paid');
  const refundedOrders = (orders ?? []).filter(o => o.payment_status === 'refunded');

  const rateGroups = new Map<number, { taxable: number; cgst: number; sgst: number; tax: number }>();
  let totalTaxableSales = 0;
  let totalTax = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalServiceCharge = 0;
  let totalGross = 0;

  for (const o of paidOrders) {
    totalTaxableSales += o.subtotal ?? 0;
    totalTax += o.tax_amount ?? 0;
    totalCgst += o.cgst_amount ?? 0;
    totalSgst += o.sgst_amount ?? 0;
    totalServiceCharge += o.service_charge_amount ?? 0;
    totalGross += o.grand_total ?? 0;

    const rate = o.gst_rate_snapshot ?? 5;
    const existing = rateGroups.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, tax: 0 };
    existing.taxable += o.subtotal ?? 0;
    existing.cgst += o.cgst_amount ?? 0;
    existing.sgst += o.sgst_amount ?? 0;
    existing.tax += o.tax_amount ?? 0;
    rateGroups.set(rate, existing);
  }

  const dailyMap = new Map<string, {
    date: string;
    orders: number;
    taxable: number;
    cgst: number;
    sgst: number;
    tax: number;
    gross: number;
  }>();

  for (const o of paidOrders) {
    const d = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const existing = dailyMap.get(d) ?? { date: d, orders: 0, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0 };
    existing.orders += 1;
    existing.taxable += o.subtotal ?? 0;
    existing.cgst += o.cgst_amount ?? 0;
    existing.sgst += o.sgst_amount ?? 0;
    existing.tax += o.tax_amount ?? 0;
    existing.gross += o.grand_total ?? 0;
    dailyMap.set(d, existing);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const dayOrdersMap = new Map<string, typeof paidOrders>();
  for (const o of paidOrders) {
    const d = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const list = dayOrdersMap.get(d) ?? [];
    list.push(o);
    dayOrdersMap.set(d, list);
  }

  const dayOrders: Record<string, Array<{
    id: string;
    order_number: number;
    time: string;
    table: string | null;
    taxable: number;
    cgst: number;
    sgst: number;
    total: number;
  }>> = {};

  for (const [d, list] of dayOrdersMap) {
    dayOrders[d] = list.map(o => ({
      id: o.id,
      order_number: o.order_number,
      time: new Date(o.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
      table: (() => {
        const t = Array.isArray(o.table) ? o.table[0] : o.table;
        if (!t) return null;
        return (t as { display_name: string | null; table_number: number }).display_name?.trim() || `#${(t as { table_number: number }).table_number}`;
      })(),
      taxable: o.subtotal ?? 0,
      cgst: o.cgst_amount ?? 0,
      sgst: o.sgst_amount ?? 0,
      total: o.grand_total ?? 0,
    }));
  }

  const refunds = refundedOrders.map(o => ({
    id: o.id,
    order_number: o.order_number,
    date: new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    original_amount: o.grand_total ?? 0,
    tax_amount: o.tax_amount ?? 0,
    cgst: o.cgst_amount ?? 0,
    sgst: o.sgst_amount ?? 0,
  }));

  const rateSummary = Array.from(rateGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, v]) => ({
      rate,
      taxable: Math.round(v.taxable * 100) / 100,
      cgst: Math.round(v.cgst * 100) / 100,
      sgst: Math.round(v.sgst * 100) / 100,
      tax: Math.round(v.tax * 100) / 100,
    }));

  return NextResponse.json({
    summary: {
      taxable_sales: Math.round(totalTaxableSales * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total_cgst: Math.round(totalCgst * 100) / 100,
      total_sgst: Math.round(totalSgst * 100) / 100,
      service_charge: Math.round(totalServiceCharge * 100) / 100,
      gross: Math.round(totalGross * 100) / 100,
      order_count: paidOrders.length,
    },
    rate_summary: rateSummary,
    daily,
    day_orders: dayOrders,
    refunds,
  });
}
