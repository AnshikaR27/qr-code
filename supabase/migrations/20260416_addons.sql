-- ============================================================
-- ADD-ONS & CUSTOMIZATION SYSTEM
-- Migration: 20260416_addons.sql
-- ============================================================

-- ── addon_groups ──────────────────────────────────────────────────────────────
CREATE TABLE addon_groups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  -- 'checkbox' = pick multiple; 'radio' = pick exactly one
  selection_type  TEXT        NOT NULL DEFAULT 'checkbox'
                              CHECK (selection_type IN ('checkbox', 'radio')),
  is_required     BOOLEAN     NOT NULL DEFAULT false,
  max_selections  INT,        -- NULL = unlimited (for checkbox type)
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addon_groups_restaurant ON addon_groups(restaurant_id);

-- ── addon_items ───────────────────────────────────────────────────────────────
CREATE TABLE addon_items (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_group_id UUID     NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  name           TEXT     NOT NULL,
  price          NUMERIC  NOT NULL DEFAULT 0,
  is_veg         BOOLEAN  NOT NULL DEFAULT true,
  is_available   BOOLEAN  NOT NULL DEFAULT true,
  sort_order     INT      NOT NULL DEFAULT 0
);

CREATE INDEX idx_addon_items_group ON addon_items(addon_group_id);

-- ── product_addon_groups (assign a group to specific products) ────────────────
CREATE TABLE product_addon_groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  UNIQUE(product_id, addon_group_id)
);

CREATE INDEX idx_product_addon_groups_product   ON product_addon_groups(product_id);
CREATE INDEX idx_product_addon_groups_addongroup ON product_addon_groups(addon_group_id);

-- ── category_addon_groups (assign a group to an entire category) ──────────────
CREATE TABLE category_addon_groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  UNIQUE(category_id, addon_group_id)
);

CREATE INDEX idx_category_addon_groups_category  ON category_addon_groups(category_id);
CREATE INDEX idx_category_addon_groups_addongroup ON category_addon_groups(addon_group_id);

-- ── Alter order_items to store selected add-ons ────────────────────────────────
-- JSON format: [{"addon_item_id":"uuid","name":"Extra Cheese","price":30}, ...]
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_addons JSONB NOT NULL DEFAULT '[]';

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE addon_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_addon_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_addon_groups ENABLE ROW LEVEL SECURITY;

-- addon_groups: owner CRUD their own; public can SELECT
CREATE POLICY "Owner manages own addon_groups"
  ON addon_groups FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view addon_groups"
  ON addon_groups FOR SELECT
  USING (true);

-- addon_items: owner via group→restaurant; public can SELECT
CREATE POLICY "Owner manages own addon_items"
  ON addon_items FOR ALL
  USING (
    addon_group_id IN (
      SELECT id FROM addon_groups
      WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Public can view addon_items"
  ON addon_items FOR SELECT
  USING (true);

-- product_addon_groups: owner via product→restaurant; public can SELECT
CREATE POLICY "Owner manages own product_addon_groups"
  ON product_addon_groups FOR ALL
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Public can view product_addon_groups"
  ON product_addon_groups FOR SELECT
  USING (true);

-- category_addon_groups: owner via category→restaurant; public can SELECT
CREATE POLICY "Owner manages own category_addon_groups"
  ON category_addon_groups FOR ALL
  USING (
    category_id IN (
      SELECT id FROM categories
      WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Public can view category_addon_groups"
  ON category_addon_groups FOR SELECT
  USING (true);

-- ── Enable Realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE addon_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE addon_items;
