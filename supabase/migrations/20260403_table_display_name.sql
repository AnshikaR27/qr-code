-- Add human-readable display name to tables.
-- display_name is what shows in the UI (e.g. "L1", "VIP2", "P3").
-- table_number remains the internal integer key used in orders and waiter_calls.
-- Falls back to #table_number in all UI when display_name is NULL.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Partial unique index: no two tables in the same restaurant can share a display_name,
-- but NULL values are always allowed (tables without a custom name).
CREATE UNIQUE INDEX IF NOT EXISTS tables_restaurant_display_name
  ON tables(restaurant_id, display_name)
  WHERE display_name IS NOT NULL;
