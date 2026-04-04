-- Add hero_image_url column for Sunday theme welcome screen
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
