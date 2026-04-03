-- Add ui_theme column to restaurants
-- 'classic' = original card-based UI
-- 'sunday'  = minimal list-based UI (Sunday-app inspired)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS ui_theme text NOT NULL DEFAULT 'classic'
  CHECK (ui_theme IN ('classic', 'sunday'));
