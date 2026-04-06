-- Add dietary_tags column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_tags text DEFAULT NULL;
