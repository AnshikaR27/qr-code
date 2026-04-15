import { ESCPOSBuilder, formatINR, formatDateTime } from './escpos';
import { computeBill } from './billing';
import type { BillingConfig, OrderItem } from '@/types';

export interface BillOrderData {
  order_number: number;
  order_type: string;
  customer_name: string | null;
  created_at: string;
  notes: string | null;
  table?: { table_number: number; display_name?: string | null } | null;
  items?: Pick<OrderItem, 'name' | 'quantity' | 'price' | 'tax_category' | 'selected_addons'>[];
}

export function buildBillReceipt(
  order: BillOrderData,
  restaurantName: string,
  restaurantPhone: string | null,
  config: BillingConfig,
  paperWidth: '80mm' | '58mm' = '80mm',
  duplicate = false,
): Uint8Array {
  const lineWidth = paperWidth === '58mm' ? 32 : 42;
  const bill = computeBill(order.items ?? [], config);
  const legalName = config.legal_name?.trim() || restaurantName;

  const tableDisplay = order.table
    ? (order.table.display_name?.trim() || String(order.table.table_number))
    : null;
  const tableInfo = order.order_type === 'dine_in'
    ? (tableDisplay ? `Table: ${tableDisplay}` : 'Dine-In')
    : `Parcel${order.customer_name ? ` - ${order.customer_name}` : ''}`;

  const p = new ESCPOSBuilder();
  p.initialize();

  // ── Duplicate header ──
  if (duplicate) {
    p.alignCenter()
      .bold(true)
      .text('-- DUPLICATE --')
      .newLine()
      .bold(false);
  }

  // ── Restaurant header ──
  p.alignCenter()
    .bold(true)
    .doubleHeight(true)
    .text(legalName.toUpperCase().slice(0, lineWidth))
    .doubleHeight(false)
    .newLine()
    .bold(false);

  if (config.billing_address?.trim()) {
    p.text(config.billing_address.trim().slice(0, lineWidth)).newLine();
  }
  if (config.state?.trim()) {
    p.text(config.state.trim().slice(0, lineWidth)).newLine();
  }
  if (restaurantPhone) {
    p.text(`Ph: ${restaurantPhone}`.slice(0, lineWidth)).newLine();
  }
  if (config.gstin?.trim()) {
    p.text(`GSTIN: ${config.gstin.trim()}`.slice(0, lineWidth)).newLine();
  }
  if (config.fssai?.trim()) {
    p.text(`FSSAI: ${config.fssai.trim()}`.slice(0, lineWidth)).newLine();
  }

  p.dashLine(lineWidth);

  // ── TAX INVOICE header ──
  p.alignCenter()
    .bold(true)
    .text('TAX INVOICE')
    .newLine()
    .bold(false);

  p.dashLine(lineWidth);

  // ── Bill meta ──
  p.alignLeft()
    .text(`Bill No: #${order.order_number}`)
    .newLine()
    .text(formatDateTime(order.created_at).slice(0, lineWidth))
    .newLine()
    .text(tableInfo.slice(0, lineWidth))
    .newLine();

  p.dashLine(lineWidth);

  // ── Column header ──
  p.bold(true)
    .itemLine('ITEM', 'QTY', 'RATE', 'AMT', paperWidth === '58mm' ? [14, 4, 7, 7] : [20, 4, 8, 10])
    .bold(false);

  p.dashLine(lineWidth);

  // ── Items (effective price = base + addons) ──
  const colWidths: [number, number, number, number] = paperWidth === '58mm' ? [14, 4, 7, 7] : [20, 4, 8, 10];
  for (const item of bill.items) {
    p.itemLine(
      item.name,
      String(item.qty),
      formatINR(item.unit_price),
      formatINR(item.total),
      colWidths,
    );

    // Print addon lines (indented) for items that have addons
    const originalItem = (order.items ?? []).find((oi) => oi.name === item.name);
    const addons = originalItem?.selected_addons ?? [];
    for (const addon of addons) {
      if (addon.price > 0) {
        const addonLabel = `  + ${addon.name}`;
        p.text(addonLabel.slice(0, lineWidth - 8))
          .text(' '.repeat(Math.max(0, lineWidth - 8 - addonLabel.slice(0, lineWidth - 8).length)))
          .text(`+${formatINR(addon.price)}`)
          .newLine();
      } else {
        p.text(`  + ${addon.name}`.slice(0, lineWidth)).newLine();
      }
    }
  }

  p.dashLine(lineWidth);

  // ── Subtotal & service charge ──
  p.textColumns('Subtotal', formatINR(bill.subtotal), lineWidth);
  if (bill.service_charge_amount > 0) {
    p.textColumns(`Service Charge (${bill.service_charge_percent}%)`, formatINR(bill.service_charge_amount), lineWidth);
  }

  p.dashLine(lineWidth);

  // ── Tax lines ──
  for (const tl of bill.tax_lines) {
    p.textColumns(`CGST @${tl.cgst_rate}%`, `\u20B9${tl.cgst_amount.toFixed(2)}`, lineWidth);
    p.textColumns(`SGST @${tl.sgst_rate}%`, `\u20B9${tl.sgst_amount.toFixed(2)}`, lineWidth);
  }
  p.textColumns('Total Tax', `\u20B9${bill.total_tax.toFixed(2)}`, lineWidth);

  if (bill.round_off !== 0) {
    p.textColumns('Round Off', (bill.round_off > 0 ? '+' : '') + `\u20B9${Math.abs(bill.round_off).toFixed(2)}`, lineWidth);
  }

  p.dashLine(lineWidth);

  // ── Grand total (large) ──
  p.alignCenter()
    .bold(true)
    .doubleSize(true)
    .text(`TOTAL ${formatINR(bill.grand_total)}`)
    .doubleSize(false)
    .newLine()
    .bold(false);

  p.dashLine(lineWidth);

  // ── Footer ──
  if (config.sac_code?.trim()) {
    p.alignCenter().text(`SAC: ${config.sac_code.trim()}`).newLine();
  }
  if (config.fssai?.trim()) {
    p.alignCenter().text(`FSSAI: ${config.fssai.trim()}`).newLine();
  }

  if (order.notes) {
    p.dashLine(lineWidth);
    p.alignLeft().wrapText(`Note: ${order.notes}`, lineWidth);
  }

  p.dashLine(lineWidth);

  p.alignCenter()
    .bold(true)
    .text('Thank you! Visit again.')
    .newLine()
    .bold(false);

  p.feed(4).cut();

  return p.build();
}
