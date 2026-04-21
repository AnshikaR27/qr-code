-- ============================================================
-- STAFF MEMBERS
-- ============================================================

CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('waiter', 'kitchen')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_restaurant ON staff_members(restaurant_id);
CREATE UNIQUE INDEX idx_staff_restaurant_pin ON staff_members(restaurant_id, pin);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages staff"
  ON staff_members FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- ============================================================
-- ORDERS: staff attribution
-- ============================================================

ALTER TABLE orders ADD COLUMN placed_by_staff_id UUID REFERENCES staff_members(id);

-- ============================================================
-- ORDER ITEMS: void support
-- ============================================================

ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'voided'));
ALTER TABLE order_items ADD COLUMN void_reason TEXT;
ALTER TABLE order_items ADD COLUMN voided_by UUID REFERENCES staff_members(id);
ALTER TABLE order_items ADD COLUMN voided_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN original_quantity INTEGER;

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('owner', 'staff', 'customer', 'system')),
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_restaurant ON activity_log(restaurant_id);
CREATE INDEX idx_activity_log_created ON activity_log(restaurant_id, created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views activity log"
  ON activity_log FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Service role inserts from API routes — no INSERT policy needed for auth users

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE staff_members;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
