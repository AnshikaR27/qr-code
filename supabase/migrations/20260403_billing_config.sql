-- Add billing_config JSONB to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_config JSONB;

-- Add tax_category to products (default 'food')
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category TEXT NOT NULL DEFAULT 'food';

-- Add tax_category to order_items (snapshot at order time)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_category TEXT NOT NULL DEFAULT 'food';
