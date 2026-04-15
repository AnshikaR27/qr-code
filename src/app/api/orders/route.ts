import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { placeOrderSchema } from '@/lib/validators';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate with Zod
  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const {
    restaurant_id,
    table_id,
    order_type,
    customer_name,
    customer_phone,
    notes,
    items,
  } = parsed.data;

  // Verify restaurant exists
  const { data: restaurant, error: restErr } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('id', restaurant_id)
    .eq('is_active', true)
    .single();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  // Fetch product prices server-side — never trust client prices.
  // Also grab name_hindi and the category name (via FK) so we can
  // denormalize them into order_items for kitchen ticket printing.
  const productIds = items.map((i) => i.product_id);
  const { data: dbProducts, error: prodErr } = await getSupabaseAdmin()
    .from('products')
    .select('id, price, name, name_hindi, is_available, category:categories(name)')
    .in('id', productIds)
    .eq('restaurant_id', restaurant_id);

  if (prodErr || !dbProducts) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }

  // Check all products exist and are available
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));
  for (const item of items) {
    const p = productMap.get(item.product_id);
    if (!p) {
      return NextResponse.json(
        { error: `Product not found: ${item.product_id}` },
        { status: 422 }
      );
    }
    if (!p.is_available) {
      return NextResponse.json(
        { error: `"${p.name}" is currently unavailable` },
        { status: 422 }
      );
    }
  }

  // Validate selected_addons against the database to get canonical prices.
  // We fetch all referenced addon_item ids in one query, then build a map.
  const allAddonItemIds: string[] = [];
  for (const item of items) {
    for (const addon of item.selected_addons ?? []) {
      if (addon.addon_item_id) allAddonItemIds.push(addon.addon_item_id);
    }
  }

  const addonItemMap = new Map<string, { name: string; price: number }>();
  if (allAddonItemIds.length > 0) {
    const { data: addonItems } = await getSupabaseAdmin()
      .from('addon_items')
      .select('id, name, price')
      .in('id', allAddonItemIds);

    for (const ai of addonItems ?? []) {
      addonItemMap.set(ai.id, { name: ai.name, price: Number(ai.price) });
    }
  }

  // Calculate total server-side using DB prices (base + addon prices)
  const total = items.reduce((sum, item) => {
    const p = productMap.get(item.product_id)!;
    const addonTotal = (item.selected_addons ?? []).reduce((s, addon) => {
      const dbAddon = addonItemMap.get(addon.addon_item_id);
      return s + (dbAddon?.price ?? 0);
    }, 0);
    return sum + (p.price + addonTotal) * item.quantity;
  }, 0);

  // Insert order
  const { data: order, error: orderErr } = await getSupabaseAdmin()
    .from('orders')
    .insert({
      restaurant_id,
      table_id: table_id ?? null,
      order_type,
      customer_name: customer_name ?? null,
      customer_phone: customer_phone ?? null,
      notes: notes ?? null,
      total,
      status: 'placed',
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Insert order items using DB prices and names.
  // selected_addons is stored as JSONB with server-validated prices.
  const orderItems = items.map((item) => {
    const p = productMap.get(item.product_id)!;
    // Supabase returns the FK-joined row as an object or null at runtime,
    // but the inferred TS type may show it as an array — cast via unknown.
    const categoryName =
      (p.category as unknown as { name: string } | null)?.name ?? null;

    // Build canonical selected_addons using DB prices
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
      name: p.name,                    // denormalized from DB, not client
      name_hindi: p.name_hindi ?? null, // for bilingual kitchen tickets
      price: p.price,                  // BASE price only (addons carry their own)
      quantity: item.quantity,
      notes: item.notes ?? null,
      category_name: categoryName,     // owner's existing category, for station printing
      selected_addons: selectedAddons, // validated against DB
    };
  });

  const { error: itemsErr } = await getSupabaseAdmin().from('order_items').insert(orderItems);

  if (itemsErr) {
    console.error('Order items insert error:', itemsErr);
    // Order was created — return it anyway so customer can track
  }

  return NextResponse.json(
    { orderId: order.id, orderNumber: order.order_number },
    { status: 201 }
  );
}
