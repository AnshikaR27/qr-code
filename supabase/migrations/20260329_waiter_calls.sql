-- waiter_calls: customers tap "Call Waiter" on the menu page
CREATE TABLE IF NOT EXISTS waiter_calls (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id      UUID REFERENCES tables(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'acknowledged')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waiter_calls_restaurant ON waiter_calls (restaurant_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;

-- RLS
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

-- Anyone (customers via anon key) can insert a call
CREATE POLICY "anon_insert_waiter_calls"
  ON waiter_calls FOR INSERT
  TO anon
  WITH CHECK (true);

-- Restaurant owners can read + update their own calls
CREATE POLICY "owner_read_waiter_calls"
  ON waiter_calls FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_update_waiter_calls"
  ON waiter_calls FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
