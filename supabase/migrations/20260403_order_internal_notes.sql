-- Add internal staff notes to orders.
-- Structure: [{ id, text, created_at }]
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]';
