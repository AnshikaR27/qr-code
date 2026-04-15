import type { SupabaseClient } from '@supabase/supabase-js';
import type { AddonGroup, AddonItem } from '@/types';

/**
 * Fetch all addon groups applicable to a product.
 *
 * Merges two sources:
 *  1. product_addon_groups  — groups assigned directly to this product
 *  2. category_addon_groups — groups assigned to its parent category
 *
 * Deduplicates by addon_group_id, then includes addon_items sorted by sort_order.
 */
export async function getAddonGroupsForProduct(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  productId: string,
  categoryId: string | null,
): Promise<AddonGroup[]> {
  // 1. Fetch group IDs assigned directly to the product
  const { data: productLinks } = await supabase
    .from('product_addon_groups')
    .select('addon_group_id')
    .eq('product_id', productId);

  // 2. Fetch group IDs assigned to the product's category (if any)
  const { data: categoryLinks } = categoryId
    ? await supabase
        .from('category_addon_groups')
        .select('addon_group_id')
        .eq('category_id', categoryId)
    : { data: [] };

  // Collect all unique group IDs
  const groupIdSet = new Set<string>();
  for (const row of productLinks ?? []) groupIdSet.add(row.addon_group_id);
  for (const row of categoryLinks ?? []) groupIdSet.add(row.addon_group_id);

  if (groupIdSet.size === 0) return [];

  const groupIds = Array.from(groupIdSet);

  // 3. Fetch the groups themselves
  const { data: groups, error: groupsErr } = await supabase
    .from('addon_groups')
    .select('*')
    .in('id', groupIds)
    .order('sort_order', { ascending: true });

  if (groupsErr || !groups) return [];

  // 4. Fetch all items for these groups in one query
  const { data: items, error: itemsErr } = await supabase
    .from('addon_items')
    .select('*')
    .in('addon_group_id', groupIds)
    .order('sort_order', { ascending: true });

  if (itemsErr) return [];

  const allItems: AddonItem[] = items ?? [];

  // 5. Attach items to their groups
  return (groups as Omit<AddonGroup, 'items'>[]).map((group) => ({
    ...group,
    items: allItems.filter((item) => item.addon_group_id === group.id),
  }));
}
