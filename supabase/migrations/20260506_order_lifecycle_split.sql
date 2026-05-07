-- Order lifecycle split: orthogonal food-status and payment-status axes.
--
-- orders.status         → placed | preparing | ready | served | cancelled
-- orders.payment_status → unpaid | paid | refunded | comped
--
-- Applied to an empty orders table (all transactional rows truncated).
-- No backfill needed; 'delivered' is dropped cleanly from the enum.

BEGIN;

-- 1. Rebuild order_status enum without 'delivered'
ALTER TYPE order_status RENAME TO order_status_old;
CREATE TYPE order_status AS ENUM ('placed', 'preparing', 'ready', 'served', 'cancelled');
ALTER TABLE orders
  ALTER COLUMN status TYPE order_status
  USING status::text::order_status;
DROP TYPE order_status_old;

-- 2. Create payment_status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'comped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add payment_status column
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'unpaid';

COMMIT;
