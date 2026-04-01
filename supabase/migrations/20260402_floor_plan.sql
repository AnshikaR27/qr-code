-- Add a JSONB floor plan to the restaurants table.
-- Structure: { tables: [{ id, table_number, x, y, shape, capacity }], labels: [{ id, text, x, y }] }
-- `id` in each table entry is the UUID from the `tables` table (same FK used by orders).
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS floor_plan JSONB;
