-- Add service_mode to restaurants
-- 'self_service': customer collects from counter (play alerts)
-- 'table_service': staff delivers to table (no customer alerts)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'self_service'
  CHECK (service_mode IN ('self_service', 'table_service'));
