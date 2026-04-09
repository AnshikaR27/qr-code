import { ESCPOSBuilder, formatDateTime } from './escpos';
import type { OrderItem } from '@/types';

export interface KOTData {
  order_number: number;
  order_type: string;
  customer_name: string | null;
  created_at: string;
  notes: string | null;
  table?: { table_number: number; display_name?: string | null } | null;
  items?: Pick<OrderItem, 'name' | 'quantity' | 'price' | 'category_name' | 'notes'>[];
}

export function buildKOTTicket(
  order: KOTData,
  restaurantName: string,
  kotNumber: number,
  selectedCategories: string[],
  paperWidth: '80mm' | '58mm' = '80mm',
  totalCategoriesInOrder?: number, // when routing splits across printers, pass the full order cat count
): Uint8Array {
  const lineWidth = paperWidth === '58mm' ? 32 : 42;
  const allItems = order.items ?? [];
  const filtered = allItems.filter((i) =>
    selectedCategories.includes(i.category_name ?? 'Uncategorized')
  );

  const allCats = Array.from(new Set(allItems.map((i) => i.category_name ?? 'Uncategorized')));
  // isStation = this ticket is a SUBSET of the full order (show station header)
  const totalCats = totalCategoriesInOrder ?? allCats.length;
  const isStation = selectedCategories.length < totalCats;

  // Group items by category
  const groups = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const key = item.category_name ?? 'Uncategorized';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const tableDisplay = order.table
    ? (order.table.display_name?.trim() || String(order.table.table_number))
    : null;
  const tableInfo = order.order_type === 'dine_in'
    ? (tableDisplay ? `TABLE: ${tableDisplay}` : 'DINE-IN')
    : `PARCEL${order.customer_name ? ` - ${order.customer_name.toUpperCase()}` : ''}`;

  const p = new ESCPOSBuilder();
  p.initialize();

  // Header
  p.alignCenter()
    .bold(true)
    .text(restaurantName.toUpperCase().slice(0, lineWidth))
    .newLine()
    .bold(false)
    .text('KITCHEN ORDER TICKET')
    .newLine();

  p.dashLine(lineWidth);

  // KOT number (large)
  p.alignCenter()
    .doubleSize(true)
    .text(`KOT #${String(kotNumber).padStart(3, '0')}`)
    .doubleSize(false)
    .newLine()
    .bold(true)
    .text(`ORDER #${order.order_number}`)
    .newLine()
    .bold(false);

  p.dashLine(lineWidth);

  // Station line (if subset of categories)
  if (isStation) {
    p.alignCenter()
      .bold(true)
      .text(`STATION: ${selectedCategories.map((c) => c.toUpperCase()).join(' + ')}`.slice(0, lineWidth))
      .newLine()
      .bold(false);
    p.dashLine(lineWidth);
  }

  // Table + time
  p.alignLeft()
    .bold(true)
    .text(tableInfo.slice(0, lineWidth))
    .newLine()
    .bold(false)
    .text(formatDateTime(order.created_at).slice(0, lineWidth))
    .newLine();

  p.dashLine(lineWidth);

  // Items grouped by category
  for (const [cat, catItems] of Array.from(groups)) {
    if (groups.size > 1) {
      p.bold(true).text(cat.toUpperCase().slice(0, lineWidth)).newLine().bold(false);
    }
    for (const item of catItems) {
      p.bold(true)
        .text(`${item.quantity}x `)
        .bold(false)
        .text(item.name.slice(0, lineWidth - 3))
        .newLine();
      if (item.notes) {
        p.wrapText(`* ${item.notes}`, lineWidth, '   ');
      }
    }
  }

  p.dashLine(lineWidth);

  // Order notes
  if (order.notes) {
    p.wrapText(`NOTE: ${order.notes}`, lineWidth);
    p.dashLine(lineWidth);
  }

  // Footer
  p.alignCenter()
    .text(`KOT #${String(kotNumber).padStart(3, '0')}  ORDER #${order.order_number}`)
    .newLine();

  p.feed(4).cut();

  return p.build();
}
