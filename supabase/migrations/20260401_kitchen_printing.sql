-- ─────────────────────────────────────────────────────────────────────────────
-- Kitchen Ticket Printing Support
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Denormalize name_hindi + category_name into order_items at order-placement
--    time so tickets are always accurate even if the menu changes later.
--    category_name comes from the existing categories table via products.category_id.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS name_hindi     TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category_name  TEXT;

-- 2. Daily KOT (Kitchen Order Ticket) counter table.
--    The (restaurant_id, counter_date) primary key means the counter resets
--    automatically every day — no cron job required.
CREATE TABLE IF NOT EXISTS kot_counters (
  restaurant_id UUID    NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  counter_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  counter       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, counter_date)
);

ALTER TABLE kot_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their KOT counters"
  ON kot_counters
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- 3. Atomic KOT-number increment — safe under concurrent requests.
CREATE OR REPLACE FUNCTION get_next_kot_number(p_restaurant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter INTEGER;
BEGIN
  INSERT INTO kot_counters (restaurant_id, counter_date, counter)
  VALUES (p_restaurant_id, CURRENT_DATE, 1)
  ON CONFLICT (restaurant_id, counter_date)
  DO UPDATE SET counter = kot_counters.counter + 1
  RETURNING counter INTO v_counter;

  RETURN v_counter;
END;
$$;
