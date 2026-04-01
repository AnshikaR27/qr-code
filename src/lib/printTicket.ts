import type { Order } from '@/types';

// ─── Ticket HTML builder ──────────────────────────────────────────────────────

function buildTicketHtml(
  order: Order,
  kotNumber: number,
  restaurantName: string,
  selectedCategories: string[],
): string {
  const allItems  = order.items ?? [];
  const filtered  = allItems.filter((i) =>
    selectedCategories.includes(i.category_name ?? 'Uncategorized'),
  );
  const allCats   = Array.from(new Set(allItems.map((i) => i.category_name ?? 'Uncategorized')));
  const isFiltered = selectedCategories.length < allCats.length;

  // Group filtered items by category, preserving first-seen order
  const groups = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const key = item.category_name ?? 'Uncategorized';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const sortedCats = Array.from(groups.keys());

  const time = new Date(order.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const tableInfo = order.order_type === 'dine_in'
    ? (order.table ? `TABLE: ${order.table.table_number}` : 'DINE-IN')
    : `PARCEL${order.customer_name ? ` \u2014 ${order.customer_name.toUpperCase()}` : ''}`;

  const kotStr = String(kotNumber).padStart(3, '0');

  const stationLine = isFiltered
    ? `<div style="text-align:center;font-weight:bold;border:2px solid #000;padding:2px 4px;margin:4px 0;font-size:11px;">
         STATION: ${selectedCategories.map((c) => c.toUpperCase()).join(' + ')}
       </div>`
    : '';

  // ── Items section
  let itemsHtml = '';
  for (const cat of sortedCats) {
    const catItems = groups.get(cat)!;

    if (sortedCats.length > 1) {
      itemsHtml += `
        <div style="margin:6px 0 2px;border-top:1px dashed #000;padding-top:4px;font-weight:bold;">
          ${cat.toUpperCase()}
        </div>`;
    }

    for (const item of catItems) {
      const lineTotal = (item.price * item.quantity).toFixed(0);
      itemsHtml += `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin:3px 0;">
          <tr>
            <td style="width:22px;font-weight:bold;vertical-align:top;">${item.quantity}x</td>
            <td style="vertical-align:top;">${item.name}</td>
            <td style="text-align:right;white-space:nowrap;vertical-align:top;">&#8377;${lineTotal}</td>
          </tr>
          ${item.name_hindi ? `<tr><td></td><td colspan="2" style="font-size:11px;color:#333;">${item.name_hindi}</td></tr>` : ''}
          ${item.notes ? `<tr><td></td><td colspan="2" style="font-size:10px;font-style:italic;">* ${item.notes}</td></tr>` : ''}
        </table>`;
    }
  }

  const stationTotal = filtered.reduce((s, i) => s + i.price * i.quantity, 0);
  const notesSection = order.notes
    ? `<div style="border-top:1px dashed #000;margin:4px 0;"></div>
       <div style="font-size:11px;margin:3px 0;"><strong>NOTE:</strong> ${order.notes}</div>`
    : '';

  return `
<div style="font-family:'Courier New',Courier,monospace;font-size:12px;width:72mm;color:#000;background:#fff;padding:3mm 4mm;">

  <div style="text-align:center;font-size:13px;font-weight:bold;margin-bottom:1px;">
    ${restaurantName.toUpperCase()}
  </div>
  <div style="text-align:center;font-size:10px;margin-bottom:4px;">KITCHEN ORDER TICKET</div>

  <div style="border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin:0 0 4px;text-align:center;">
    <span style="font-size:15px;font-weight:bold;">KOT #${kotStr}</span>
    &nbsp;&nbsp;
    <span style="font-size:13px;font-weight:bold;">ORDER #${order.order_number}</span>
  </div>

  ${stationLine}

  <div style="font-size:11px;margin-bottom:4px;">
    <div><strong>${tableInfo}</strong></div>
    <div>${date} &middot; ${time}</div>
  </div>

  <div style="border-top:1px dashed #000;margin:4px 0;"></div>

  ${itemsHtml}

  <div style="border-top:1px dashed #000;margin:4px 0;"></div>

  ${notesSection}

  <table style="width:100%;border-collapse:collapse;font-weight:bold;font-size:12px;margin:4px 0;">
    <tr>
      <td>TOTAL${isFiltered ? ' (STATION)' : ''}:</td>
      <td style="text-align:right;">&#8377;${stationTotal.toFixed(0)}</td>
    </tr>
  </table>

  <div style="border-top:2px solid #000;margin:4px 0;"></div>
  <div style="text-align:center;font-size:10px;">
    KOT #${kotStr} &middot; ORDER #${order.order_number}
  </div>

</div>`;
}

// ─── Public print function ────────────────────────────────────────────────────

const PRINT_DIV_ID   = 'kot-print-container';
const PRINT_STYLE_ID = 'kot-print-styles';

export function printKitchenTicket(
  order: Order,
  kotNumber: number,
  restaurantName: string,
  selectedCategories: string[],
): void {
  const html = buildTicketHtml(order, kotNumber, restaurantName, selectedCategories);

  // Remove any leftover containers from a previous print
  document.getElementById(PRINT_DIV_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const printDiv    = document.createElement('div');
  printDiv.id       = PRINT_DIV_ID;
  printDiv.innerHTML = html;
  document.body.appendChild(printDiv);

  const style      = document.createElement('style');
  style.id         = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      body > *:not(#${PRINT_DIV_ID}) { display: none !important; }
      #${PRINT_DIV_ID} {
        display: block !important;
        position: fixed;
        top: 0;
        left: 0;
        width: 80mm;
      }
      @page { size: 80mm auto; margin: 0; }
    }
    #${PRINT_DIV_ID} { display: none; }
  `;
  document.head.appendChild(style);

  window.print();

  const cleanup = () => {
    document.getElementById(PRINT_DIV_ID)?.remove();
    document.getElementById(PRINT_STYLE_ID)?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}
