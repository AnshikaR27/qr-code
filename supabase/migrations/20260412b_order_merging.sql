-- Add order-level merge grouping
-- merge_group_id: shared UUID for all orders in a merged billing group
-- Orders sharing this ID are displayed as one combined card in the Orders tab
-- and billed together with a single payment.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS merge_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_merge_group
  ON orders (merge_group_id)
  WHERE merge_group_id IS NOT NULL;
