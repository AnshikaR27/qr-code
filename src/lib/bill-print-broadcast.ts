import { createClient } from '@/lib/supabase/client';
import type { BillOrderData } from '@/lib/escpos-bill';

export async function broadcastPrintBill(restaurantId: string, order: BillOrderData & { id: string }) {
  const supabase = createClient();
  const channel = supabase.channel(`bill-print-${restaurantId}`);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      supabase.removeChannel(channel);
      reject(new Error('Channel subscribe timeout'));
    }, 5000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  await channel.send({
    type: 'broadcast',
    event: 'print-bill',
    payload: {
      order_id: order.id,
      order_number: order.order_number,
      order_type: order.order_type,
      customer_name: order.customer_name,
      created_at: order.created_at,
      notes: order.notes,
      table: order.table
        ? { table_number: order.table.table_number, display_name: order.table.display_name }
        : null,
      items: (order.items ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        tax_category: i.tax_category,
        selected_addons: i.selected_addons,
      })),
    },
  });

  supabase.removeChannel(channel);
}
