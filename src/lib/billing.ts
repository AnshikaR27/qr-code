import type { BillingConfig, TaxCategory, OrderItem, SelectedAddon } from '@/types';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface BillItem {
  name: string;
  qty: number;
  unit_price: number;
  total: number;
  tax_category: TaxCategory;
  gst_rate: number;
}

export interface TaxLine {
  label: string;
  rate: number;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  total_tax: number;
}

export interface BillBreakdown {
  items: BillItem[];
  subtotal: number;
  service_charge_percent: number;
  service_charge_amount: number;
  tax_lines: TaxLine[];
  total_tax: number;
  grand_total: number;
  round_off: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function resolveGstRate(category: TaxCategory, restaurantRate: 5 | 18): number {
  return category === 'food' ? restaurantRate : 18;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CAT_LABELS: Record<TaxCategory, string> = {
  food:             'Food',
  packaged:         'Packaged Items',
  beverage_aerated: 'Beverages',
};

// ─── Core computation ─────────────────────────────────────────────────────────

export function computeBill(
  orderItems: Pick<OrderItem, 'name' | 'quantity' | 'price' | 'tax_category' | 'selected_addons'>[],
  config: BillingConfig,
): BillBreakdown {
  const gstRate = config.gst_rate ?? 5;

  const items: BillItem[] = orderItems.map((i) => {
    const tc: TaxCategory = i.tax_category ?? 'food';
    const rate = resolveGstRate(tc, gstRate);
    // Effective unit price = base price + sum of selected addon prices
    const addons: SelectedAddon[] = i.selected_addons ?? [];
    const addonTotal = addons.reduce((s, a) => s + (a.price ?? 0), 0);
    const effectivePrice = i.price + addonTotal;
    return {
      name:       i.name,
      qty:        i.quantity,
      unit_price: effectivePrice,
      total:      effectivePrice * i.quantity,
      tax_category: tc,
      gst_rate:   rate,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  const scPct = config.service_charge_enabled ? (config.service_charge_percent ?? 0) : 0;
  const sc    = r2(subtotal * scPct / 100);

  // Group by GST rate
  const rateGroups = new Map<number, BillItem[]>();
  for (const item of items) {
    if (!rateGroups.has(item.gst_rate)) rateGroups.set(item.gst_rate, []);
    rateGroups.get(item.gst_rate)!.push(item);
  }

  const tax_lines: TaxLine[] = [];
  for (const [rate, rateItems] of Array.from(rateGroups.entries()).sort(([a], [b]) => a - b)) {
    const taxable  = rateItems.reduce((s, i) => s + i.total, 0);
    const cgst     = r2(taxable * (rate / 2) / 100);
    const cats     = Array.from(new Set(rateItems.map((i) => i.tax_category)));
    const label    = cats.length === 1
      ? `${CAT_LABELS[cats[0]]} (${rate}% GST)`
      : `Items @ ${rate}% GST`;

    tax_lines.push({
      label,
      rate,
      taxable_amount: taxable,
      cgst_rate:      rate / 2,
      cgst_amount:    cgst,
      sgst_rate:      rate / 2,
      sgst_amount:    cgst,
      total_tax:      cgst * 2,
    });
  }

  const total_tax   = r2(tax_lines.reduce((s, l) => s + l.total_tax, 0));
  const rawTotal    = subtotal + sc + total_tax;
  const grand_total = Math.round(rawTotal);
  const round_off   = r2(grand_total - rawTotal);

  return {
    items,
    subtotal,
    service_charge_percent: scPct,
    service_charge_amount:  sc,
    tax_lines,
    total_tax,
    grand_total,
    round_off,
  };
}

// ─── Print function ────────────────────────────────────────────────────────────

const BILL_DIV_ID   = 'customer-bill-container';
const BILL_STYLE_ID = 'customer-bill-styles';

export function printCustomerBill(
  order: {
    order_number: number;
    order_type: string;
    customer_name: string | null;
    created_at: string;
    notes: string | null;
    table?: { table_number: number; display_name?: string | null } | null;
    items?: Pick<OrderItem, 'name' | 'quantity' | 'price' | 'tax_category' | 'selected_addons'>[];
  },
  restaurant: { name: string; phone: string | null },
  config: BillingConfig,
): void {
  const bill = computeBill(order.items ?? [], config);

  const time = new Date(order.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const tableLabel = order.table
    ? `Table ${order.table.display_name?.trim() || order.table.table_number}`
    : null;
  const tableInfo = order.order_type === 'dine_in'
    ? (tableLabel ?? 'Dine-In')
    : `Parcel${order.customer_name ? ` \u2014 ${order.customer_name}` : ''}`;

  const legalName = config.legal_name?.trim() || restaurant.name;

  // Build item rows
  let itemRows = '';
  for (const item of bill.items) {
    itemRows += `
      <tr>
        <td style="vertical-align:top;padding:2px 0;">${item.name}</td>
        <td style="text-align:center;vertical-align:top;padding:2px 4px;">${item.qty}</td>
        <td style="text-align:right;white-space:nowrap;vertical-align:top;padding:2px 0;">&#8377;${item.unit_price.toFixed(0)}</td>
        <td style="text-align:right;white-space:nowrap;vertical-align:top;padding:2px 0;">&#8377;${item.total.toFixed(0)}</td>
      </tr>`;
  }

  // Service charge row
  const scRow = bill.service_charge_amount > 0
    ? `<tr><td>Service Charge (${bill.service_charge_percent}%)</td><td></td><td></td><td style="text-align:right;">&#8377;${bill.service_charge_amount.toFixed(2)}</td></tr>`
    : '';

  // Tax rows
  let taxRows = '';
  for (const tl of bill.tax_lines) {
    taxRows += `
      <tr>
        <td colspan="3" style="font-size:10px;">CGST @${tl.cgst_rate}%</td>
        <td style="text-align:right;font-size:10px;">&#8377;${tl.cgst_amount.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size:10px;">SGST @${tl.sgst_rate}%</td>
        <td style="text-align:right;font-size:10px;">&#8377;${tl.sgst_amount.toFixed(2)}</td>
      </tr>`;
  }

  // Round off row
  const roundRow = bill.round_off !== 0
    ? `<tr><td colspan="3" style="font-size:10px;">Round Off</td><td style="text-align:right;font-size:10px;">&#8377;${bill.round_off > 0 ? '+' : ''}${bill.round_off.toFixed(2)}</td></tr>`
    : '';

  // GSTIN / FSSAI lines
  const gstinLine = config.gstin?.trim()
    ? `<div>GSTIN: ${config.gstin.trim()}</div>`
    : '';
  const fssaiLine = config.fssai?.trim()
    ? `<div>FSSAI: ${config.fssai.trim()}</div>`
    : '';
  const addrLine = config.billing_address?.trim()
    ? `<div style="font-size:10px;">${config.billing_address.trim()}</div>`
    : '';
  const stateLine = config.state?.trim()
    ? `<div style="font-size:10px;">${config.state.trim()}</div>`
    : '';
  const phoneLine = restaurant.phone
    ? `<div style="font-size:10px;">Ph: ${restaurant.phone}</div>`
    : '';
  const sacLine = config.sac_code?.trim()
    ? `<div style="font-size:10px;margin-top:2px;">SAC Code: ${config.sac_code.trim()}</div>`
    : '';
  const notesSection = order.notes
    ? `<div style="border-top:1px dashed #000;margin:3px 0;padding-top:3px;font-size:10px;font-style:italic;">Note: ${order.notes}</div>`
    : '';

  const html = `
<div style="font-family:'Courier New',Courier,monospace;font-size:12px;width:72mm;color:#000;background:#fff;padding:3mm 4mm;">

  <div style="text-align:center;margin-bottom:3px;">
    <div style="font-size:14px;font-weight:bold;">${legalName.toUpperCase()}</div>
    ${gstinLine}
    ${addrLine}
    ${stateLine}
    ${phoneLine}
    ${fssaiLine}
  </div>

  <div style="border-top:2px solid #000;border-bottom:2px solid #000;text-align:center;padding:3px 0;margin:4px 0;font-weight:bold;font-size:11px;letter-spacing:1px;">
    TAX INVOICE
  </div>

  <div style="font-size:11px;margin-bottom:4px;">
    <div>Bill No: <strong>#${order.order_number}</strong> &middot; ${date} &middot; ${time}</div>
    <div>${tableInfo}</div>
  </div>

  <div style="border-top:1px dashed #000;margin:3px 0;"></div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead>
      <tr style="border-bottom:1px solid #000;">
        <th style="text-align:left;padding-bottom:2px;font-weight:bold;">Item</th>
        <th style="text-align:center;padding-bottom:2px;font-weight:bold;">Qty</th>
        <th style="text-align:right;padding-bottom:2px;font-weight:bold;">Rate</th>
        <th style="text-align:right;padding-bottom:2px;font-weight:bold;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="border-top:1px dashed #000;margin:3px 0;"></div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr>
      <td colspan="3">Subtotal</td>
      <td style="text-align:right;">&#8377;${bill.subtotal.toFixed(2)}</td>
    </tr>
    ${scRow}
  </table>

  <div style="border-top:1px dashed #000;margin:3px 0;"></div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    ${taxRows}
    <tr>
      <td colspan="3" style="font-weight:bold;font-size:11px;">Total Tax</td>
      <td style="text-align:right;font-weight:bold;">&#8377;${bill.total_tax.toFixed(2)}</td>
    </tr>
  </table>

  <div style="border-top:2px solid #000;margin:3px 0;"></div>

  <table style="width:100%;border-collapse:collapse;font-size:14px;font-weight:bold;">
    <tr>
      <td colspan="3">TOTAL</td>
      <td style="text-align:right;">&#8377;${bill.grand_total}</td>
    </tr>
  </table>

  ${roundRow ? `<table style="width:100%;border-collapse:collapse;">${roundRow}</table>` : ''}

  ${notesSection}

  <div style="border-top:1px dashed #000;margin:3px 0;"></div>

  <div style="text-align:center;font-size:10px;">
    ${sacLine}
    ${fssaiLine}
    <div style="margin-top:4px;font-weight:bold;">Thank you! Visit again.</div>
  </div>

</div>`;

  document.getElementById(BILL_DIV_ID)?.remove();
  document.getElementById(BILL_STYLE_ID)?.remove();

  const div     = document.createElement('div');
  div.id        = BILL_DIV_ID;
  div.innerHTML = html;
  document.body.appendChild(div);

  const style      = document.createElement('style');
  style.id         = BILL_STYLE_ID;
  style.textContent = `
    @media print {
      body > *:not(#${BILL_DIV_ID}) { display: none !important; }
      #${BILL_DIV_ID} {
        display: block !important;
        position: fixed;
        top: 0; left: 0;
        width: 80mm;
      }
      @page { size: 80mm auto; margin: 0; }
    }
    #${BILL_DIV_ID} { display: none; }
  `;
  document.head.appendChild(style);

  window.print();

  const cleanup = () => {
    document.getElementById(BILL_DIV_ID)?.remove();
    document.getElementById(BILL_STYLE_ID)?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}
