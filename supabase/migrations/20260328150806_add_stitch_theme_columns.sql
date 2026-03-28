ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS stitch_project_id TEXT,
  ADD COLUMN IF NOT EXISTS design_tokens      JSONB;

ALTER TABLE restaurants
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS secondary_color;
