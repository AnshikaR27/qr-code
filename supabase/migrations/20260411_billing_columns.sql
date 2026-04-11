-- Add discount and split-payment columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('flat', 'percentage'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_before_tax BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_methods JSONB;
