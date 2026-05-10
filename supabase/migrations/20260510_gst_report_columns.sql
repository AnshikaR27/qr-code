-- Add tax snapshot columns to orders (locked at billing time, never recomputed)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_rate_snapshot NUMERIC(5,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2);

-- Backfill existing paid orders from current data.
-- This uses the restaurant's current gst_rate and recomputes from order_items.
-- Lossy but acceptable: all historical orders used the current rate anyway.
-- Only backfills orders that have been paid/refunded (they went through billing).
UPDATE orders o
SET
  gst_rate_snapshot = COALESCE((r.billing_config->>'gst_rate')::numeric, 5),
  subtotal = CASE
    WHEN o.discount_before_tax AND COALESCE(o.discount_amount, 0) > 0 THEN
      GREATEST(sub.item_total - CASE
        WHEN o.discount_type = 'percentage' THEN ROUND(sub.item_total * o.discount_amount / 100, 2)
        ELSE COALESCE(o.discount_amount, 0)
      END, 0)
    ELSE sub.item_total
  END,
  tax_amount = ROUND(sub.computed_tax * CASE
    WHEN o.discount_before_tax AND COALESCE(o.discount_amount, 0) > 0 THEN
      GREATEST(sub.item_total - CASE
        WHEN o.discount_type = 'percentage' THEN ROUND(sub.item_total * o.discount_amount / 100, 2)
        ELSE COALESCE(o.discount_amount, 0)
      END, 0) / NULLIF(sub.item_total, 0)
    ELSE 1
  END, 2),
  cgst_amount = ROUND(sub.computed_tax * CASE
    WHEN o.discount_before_tax AND COALESCE(o.discount_amount, 0) > 0 THEN
      GREATEST(sub.item_total - CASE
        WHEN o.discount_type = 'percentage' THEN ROUND(sub.item_total * o.discount_amount / 100, 2)
        ELSE COALESCE(o.discount_amount, 0)
      END, 0) / NULLIF(sub.item_total, 0)
    ELSE 1
  END / 2, 2),
  sgst_amount = ROUND(sub.computed_tax * CASE
    WHEN o.discount_before_tax AND COALESCE(o.discount_amount, 0) > 0 THEN
      GREATEST(sub.item_total - CASE
        WHEN o.discount_type = 'percentage' THEN ROUND(sub.item_total * o.discount_amount / 100, 2)
        ELSE COALESCE(o.discount_amount, 0)
      END, 0) / NULLIF(sub.item_total, 0)
    ELSE 1
  END / 2, 2),
  service_charge_amount = CASE
    WHEN (r.billing_config->>'service_charge_enabled')::boolean = true
    THEN ROUND(sub.item_total * COALESCE((r.billing_config->>'service_charge_percent')::numeric, 0) / 100, 2)
    ELSE 0
  END,
  grand_total = o.total
FROM (
  SELECT
    oi.order_id,
    SUM(
      (oi.price + COALESCE((
        SELECT SUM((a->>'price')::numeric)
        FROM jsonb_array_elements(oi.selected_addons) a
      ), 0)) * oi.quantity
    ) AS item_total,
    SUM(
      (oi.price + COALESCE((
        SELECT SUM((a->>'price')::numeric)
        FROM jsonb_array_elements(oi.selected_addons) a
      ), 0)) * oi.quantity
      * CASE
          WHEN oi.tax_category = 'food'
          THEN COALESCE((
            SELECT (rr.billing_config->>'gst_rate')::numeric
            FROM restaurants rr
            JOIN orders oo ON oo.restaurant_id = rr.id
            WHERE oo.id = oi.order_id
          ), 5)
          ELSE 18
        END / 100
    ) AS computed_tax
  FROM order_items oi
  WHERE oi.status = 'active'
  GROUP BY oi.order_id
) sub
JOIN restaurants r ON r.id = o.restaurant_id
WHERE o.id = sub.order_id
  AND o.payment_status IN ('paid', 'refunded')
  AND o.subtotal IS NULL;

-- Backfill comped orders: all tax values are 0
UPDATE orders
SET
  subtotal = 0,
  tax_amount = 0,
  cgst_amount = 0,
  sgst_amount = 0,
  gst_rate_snapshot = 0,
  service_charge_amount = 0,
  grand_total = 0
WHERE payment_status = 'comped'
  AND subtotal IS NULL;
