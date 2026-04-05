-- Add parent_category_id so categories can nest (e.g. "Add-ons & Sides" under "Main Bowls")
ALTER TABLE categories
  ADD COLUMN parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_parent ON categories(parent_category_id);
