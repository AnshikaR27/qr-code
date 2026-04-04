-- Add tagline column for Sunday welcome screen
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tagline TEXT;
