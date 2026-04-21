import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface OrderInput {
  restaurant_id: string;
  table_id?: string | null;
  order_type: 'dine_in' | 'parcel';
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  placed_by_staff_id?: string | null;
  items: {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string | null;
    selected_addons?: { addon_item_id: string; name: string; price: number }[];
  }[];
}

interface OrderResult {
  orderId: string;
  orderNumber: number;
}

export async function createOrder(input: OrderInput): Promise<OrderResult> {
  const admin = getSupabaseAdmin();

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', input.restaurant_id)
    .eq('is_active', true)
    .single();

  if (!restaurant) throw new Error('Restaurant not found');

  const productIds = input.items.map((i) => i.product_id);
  const { data: dbProducts } = await admin
    .from('products')
    .select('id, price, name, name_hindi, is_available, category:categories(name)')
    .in('id', productIds)
    .eq('restaurant_id', input.restaurant_id);

  if (!dbProducts) throw new Error('Failed to fetch products');

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));
  for (const item of input.items) {
    const p = productMap.get(item.product_id);
    if (!p) throw new Error(`Product not found: ${item.product_id}`);
    if (!p.is_available) throw new Error(`"${p.name}" is currently unavailable`);
  }

  const allAddonItemIds: string[] = [];
  for (const item of input.items) {
    for (const addon of item.selected_addons ?? []) {
      if (addon.addon_item_id) allAddonItemIds.push(addon.addon_item_id);
    }
  }

  const addonItemMap = new Map<string, { name: string; price: number }>();
  if (allAddonItemIds.length > 0) {
    const { data: addonItems } = await admin
      .from('addon_items')
      .select('id, name, price')
      .in('id', allAddonItemIds);
    for (const ai of addonItems ?? []) {
      addonItemMap.set(ai.id, { name: ai.name, price: Number(ai.price) });
    }
  }

  const total = input.items.reduce((sum, item) => {
    const p = productMap.get(item.product_id)!;
    const addonTotal = (item.selected_addons ?? []).reduce((s, addon) => {
      const dbAddon = addonItemMap.get(addon.addon_item_id);
      return s + (dbAddon?.price ?? 0);
    }, 0);
    return sum + (p.price + addonTotal) * item.quantity;
  }, 0);

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      restaurant_id: input.restaurant_id,
      table_id: input.table_id ?? null,
      order_type: input.order_type,
      customer_name: input.customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
      notes: input.notes ?? null,
      placed_by_staff_id: input.placed_by_staff_id ?? null,
      total,
      status: 'placed',
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) throw new Error('Failed to create order');

  const orderItems = input.items.map((item) => {
    const p = productMap.get(item.product_id)!;
    const categoryName =
      (p.category as unknown as { name: string } | null)?.name ?? null;

    const selectedAddons = (item.selected_addons ?? []).map((clientAddon) => {
      const dbAddon = addonItemMap.get(clientAddon.addon_item_id);
      return {
        addon_item_id: clientAddon.addon_item_id,
        name: dbAddon?.name ?? clientAddon.name,
        price: dbAddon?.price ?? 0,
      };
    });

    return {
      order_id: order.id,
      product_id: item.product_id,
      name: p.name,
      name_hindi: p.name_hindi ?? null,
      price: p.price,
      quantity: item.quantity,
      notes: item.notes ?? null,
      category_name: categoryName,
      selected_addons: selectedAddons,
    };
  });

  await admin.from('order_items').insert(orderItems);

  return { orderId: order.id, orderNumber: order.order_number };
}
