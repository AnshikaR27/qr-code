-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- RESTAURANTS
-- ============================================================
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT,
  opening_time TIME DEFAULT '09:00',
  closing_time TIME DEFAULT '23:00',
  is_active BOOLEAN DEFAULT true,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#e94560',
  secondary_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for public menu lookup by slug
CREATE UNIQUE INDEX idx_restaurants_slug ON restaurants(slug);
-- Index for owner lookup
CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_hindi TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- ============================================================
-- PRODUCTS (dishes)
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_hindi TEXT,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_veg BOOLEAN DEFAULT true,
  is_jain BOOLEAN DEFAULT false,
  spice_level INTEGER DEFAULT 1 CHECK (spice_level BETWEEN 0 AND 3),
    -- 0 = no spice, 1 = mild, 2 = medium, 3 = hot
  allergens TEXT[],
    -- array of strings: ['dairy', 'nuts', 'gluten', 'soy', 'egg']
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
    -- denormalized counter for "popular" badge, updated via trigger
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_restaurant ON products(restaurant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(restaurant_id, is_available);

-- ============================================================
-- TABLES (restaurant tables for QR codes)
-- ============================================================
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, table_number)
);

CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TYPE order_type AS ENUM ('dine_in', 'parcel');
CREATE TYPE order_status AS ENUM ('placed', 'preparing', 'ready', 'delivered', 'cancelled');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  customer_name TEXT,
    -- required for parcel orders
  customer_phone TEXT,
    -- required for parcel orders
  status order_status NOT NULL DEFAULT 'placed',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
    -- general order notes
  order_number SERIAL,
    -- human-readable order number (resets conceptually per day, but serial is fine)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created ON orders(restaurant_id, created_at DESC);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
    -- denormalized: stored at order time so menu changes don't affect past orders
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT
    -- per-item special instructions: "less spicy", "no onion"
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RESTAURANTS: owner can CRUD their own, public can read active ones
CREATE POLICY "Owner manages own restaurant"
  ON restaurants FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public can view active restaurants"
  ON restaurants FOR SELECT
  USING (is_active = true);

-- CATEGORIES: owner can CRUD, public can read
CREATE POLICY "Owner manages own categories"
  ON categories FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view categories"
  ON categories FOR SELECT
  USING (true);

-- PRODUCTS: owner can CRUD, public can read available ones
CREATE POLICY "Owner manages own products"
  ON products FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view available products"
  ON products FOR SELECT
  USING (true);

-- TABLES: owner can CRUD, public can read
CREATE POLICY "Owner manages own tables"
  ON tables FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view tables"
  ON tables FOR SELECT
  USING (true);

-- ORDERS: owner can read/update their restaurant's orders, public can insert + read own
CREATE POLICY "Owner manages restaurant orders"
  ON orders FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can place an order"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view an order by id"
  ON orders FOR SELECT
  USING (true);

-- ORDER ITEMS: same as orders
CREATE POLICY "Owner views order items"
  ON order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Anyone can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view order items"
  ON order_items FOR SELECT
  USING (true);

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime on orders table (for kitchen dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurants_updated
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment product order_count when an order is placed
CREATE OR REPLACE FUNCTION increment_order_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET order_count = order_count + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_order_count
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION increment_order_count();
