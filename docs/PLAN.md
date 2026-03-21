# Restaurant Digital Menu — Engineering Plan

> This document is the single source of truth for building the project.
> Follow it step-by-step. Do not skip ahead. Ask before deviating.

---

## 1. What We're Building

A digital menu and ordering system for Indian restaurants. Owner uploads their menu, gets a QR code. Customers scan the QR, browse the menu, place orders. Kitchen sees orders in real time. No app install. No customer login.

**One-liner:** Upload your menu → Get a QR code → Customers order → Kitchen delivers.

---

## 2. Tech Stack

| Category | Tool | Purpose |
|----------|------|---------|
| Framework | **Next.js 14 (App Router)** | Full-stack React framework |
| Language | **TypeScript** | Type safety |
| Styling | **Tailwind CSS** | Utility-first CSS |
| Components | **shadcn/ui** | Pre-built accessible components (built on Radix UI) |
| Backend + DB | **Supabase** | PostgreSQL database, auth, real-time, storage — all-in-one |
| AI - Menu Scanner | **Google Gemini Flash** | OCR + structured extraction from menu photos |
| AI - Logo Colors | **colorthief (npm)** | Extract dominant colors from logo |
| Image Optimization | **Cloudinary** | Dish photo hosting with auto-resize + WebP |
| Emails | **Resend** | Transactional emails (welcome, password reset) |
| QR Codes | **qrcode (npm)** | Generate per-table QR codes |
| Error Tracking | **Sentry** | Production crash reporting |
| Analytics | **PostHog** | Product analytics + session replays |
| State Management | **Zustand** | Lightweight client state (cart) |
| Notifications | **react-hot-toast / sonner** | Toast notifications |
| Dates | **date-fns** | Date formatting and manipulation |
| Validation | **Zod** | Runtime schema validation for all inputs |
| Hosting | **Vercel** | Deployment + CDN + edge functions |

### What We Are NOT Using
- ~~Prisma~~ → Supabase client handles all DB queries
- ~~NextAuth~~ → Supabase Auth handles login, signup, sessions, password reset
- ~~bcrypt~~ → Supabase Auth hashes passwords internally
- ~~Pusher / Ably~~ → Supabase Realtime handles WebSocket subscriptions
- ~~Polling~~ → Supabase Realtime replaces it

---

## 3. Environment Variables

Create `.env.local` with these values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini
GOOGLE_GEMINI_API_KEY=your-gemini-key

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Resend
RESEND_API_KEY=your-resend-key

# Sentry
SENTRY_DSN=your-sentry-dsn

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Folder Structure

```
/
├── .env.local
├── PLAN.md                          ← this file
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
│
├── /public
│   └── /images                      ← static assets (logo, placeholder dish image)
│
├── /src
│   ├── /app                         ← Next.js App Router
│   │   ├── layout.tsx               ← root layout (fonts, Toaster, PostHog)
│   │   ├── page.tsx                 ← landing page (/)
│   │   ├── /login
│   │   │   └── page.tsx             ← owner login
│   │   ├── /register
│   │   │   └── page.tsx             ← owner signup + restaurant creation
│   │   ├── /auth
│   │   │   └── /callback
│   │   │       └── route.ts         ← Supabase auth callback handler
│   │   │
│   │   ├── /dashboard               ← protected — owner only
│   │   │   ├── layout.tsx           ← sidebar + auth guard
│   │   │   ├── page.tsx             ← dashboard home (today's stats)
│   │   │   ├── /orders
│   │   │   │   └── page.tsx         ← live kitchen orders (real-time)
│   │   │   ├── /menu
│   │   │   │   ├── page.tsx         ← menu manager (CRUD dishes + categories)
│   │   │   │   └── /scan
│   │   │   │       └── page.tsx     ← AI menu scanner (upload photo)
│   │   │   ├── /qr
│   │   │   │   └── page.tsx         ← QR code generator + download
│   │   │   └── /settings
│   │   │       └── page.tsx         ← restaurant info, logo, colors
│   │   │
│   │   ├── /[slug]                  ← public customer menu
│   │   │   ├── page.tsx             ← menu page (browse, filter, search, add to cart)
│   │   │   ├── /order
│   │   │   │   └── page.tsx         ← cart review + place order
│   │   │   └── /order
│   │   │       └── /[orderId]
│   │   │           └── page.tsx     ← live order status
│   │   │
│   │   └── /api                     ← API routes
│   │       ├── /menu-scan
│   │       │   └── route.ts         ← POST: send menu image to Gemini, return dishes JSON
│   │       ├── /upload-image
│   │       │   └── route.ts         ← POST: upload dish/logo image to Cloudinary
│   │       └── /qr
│   │           └── route.ts         ← POST: generate QR code PNG for a table
│   │
│   ├── /components
│   │   ├── /ui                      ← shadcn/ui components (button, input, card, dialog, etc.)
│   │   ├── /landing                 ← landing page sections
│   │   ├── /dashboard               ← dashboard-specific components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── OrderCard.tsx
│   │   │   ├── DishForm.tsx
│   │   │   ├── CategoryManager.tsx
│   │   │   └── StatsCards.tsx
│   │   ├── /menu                    ← customer menu components
│   │   │   ├── MenuHeader.tsx
│   │   │   ├── CategoryTabs.tsx
│   │   │   ├── DishCard.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── Cart.tsx
│   │   │   └── CartSheet.tsx
│   │   └── /shared                  ← reusable across pages
│   │       ├── Logo.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── /lib
│   │   ├── supabase
│   │   │   ├── client.ts            ← browser Supabase client (NEXT_PUBLIC keys)
│   │   │   ├── server.ts            ← server Supabase client (service role key)
│   │   │   └── middleware.ts        ← Supabase auth middleware helper
│   │   ├── cloudinary.ts            ← Cloudinary upload helper
│   │   ├── gemini.ts                ← Gemini Flash API helper
│   │   ├── qr.ts                    ← QR code generation helper
│   │   ├── validators.ts            ← Zod schemas for all inputs
│   │   ├── constants.ts             ← app-wide constants (order statuses, spice levels, etc.)
│   │   └── utils.ts                 ← general utilities (cn, formatPrice, slugify)
│   │
│   ├── /hooks
│   │   ├── useCart.ts               ← Zustand cart store
│   │   ├── useRealtimeOrders.ts     ← Supabase Realtime subscription for orders
│   │   └── useRestaurant.ts         ← fetch + cache restaurant data
│   │
│   ├── /types
│   │   └── index.ts                 ← all TypeScript interfaces/types
│   │
│   └── /middleware.ts               ← Next.js middleware (protect /dashboard routes)
│
└── /supabase
    └── /migrations
        └── 001_initial_schema.sql   ← full database schema
```

---

## 5. Database Schema (Supabase PostgreSQL)

Run this as a migration in the Supabase SQL editor or via CLI.

```sql
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
```

---

## 6. TypeScript Types

```typescript
// /src/types/index.ts

export type OrderType = 'dine_in' | 'parcel';
export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type SpiceLevel = 0 | 1 | 2 | 3;

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  name_hindi: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  name_hindi: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_jain: boolean;
  spice_level: SpiceLevel;
  allergens: string[];
  is_available: boolean;
  sort_order: number;
  order_count: number;
}

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: number;
  qr_code_url: string | null;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_type: OrderType;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  total: number;
  notes: string | null;
  order_number: number;
  created_at: string;
  updated_at: string;
  // joined
  items?: OrderItem[];
  table?: Table;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

// Cart (client-side only, Zustand store)
export interface CartItem {
  product_id: string;
  name: string;
  name_hindi: string | null;
  price: number;
  quantity: number;
  notes: string;
  is_veg: boolean;
}

export interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}
```

---

## 7. Zod Validators

```typescript
// /src/lib/validators.ts

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  restaurantName: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  city: z.string().min(2).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const productSchema = z.object({
  name: z.string().min(1).max(200),
  name_hindi: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().positive().max(99999),
  category_id: z.string().uuid().optional().nullable(),
  is_veg: z.boolean().default(true),
  is_jain: z.boolean().default(false),
  spice_level: z.number().int().min(0).max(3).default(1),
  allergens: z.array(z.string()).default([]),
  image_url: z.string().url().optional().nullable(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  name_hindi: z.string().max(100).optional().nullable(),
});

export const placeOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  table_id: z.string().uuid().optional().nullable(),
  order_type: z.enum(['dine_in', 'parcel']),
  customer_name: z.string().max(100).optional().nullable(),
  customer_phone: z.string().max(15).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().positive().max(50),
    notes: z.string().max(200).optional().nullable(),
  })).min(1, 'Order must have at least one item'),
}).refine(
  (data) => {
    if (data.order_type === 'parcel') {
      return data.customer_name && data.customer_name.length > 0;
    }
    return true;
  },
  { message: 'Name is required for parcel orders', path: ['customer_name'] }
);

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(['placed', 'preparing', 'ready', 'delivered', 'cancelled']),
});

export const restaurantSettingsSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  opening_time: z.string().optional(),
  closing_time: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
```

---

## 8. Supabase Client Setup

```typescript
// /src/lib/supabase/client.ts
// USE THIS IN: client components, hooks, browser-side code

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// /src/lib/supabase/server.ts
// USE THIS IN: server components, API routes, server actions

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Components (read-only)
          }
        },
      },
    }
  );
}
```

```typescript
// /src/lib/supabase/admin.ts
// USE THIS IN: API routes that need to bypass RLS (e.g., placing orders as anonymous user)

import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## 9. Middleware (Auth Guard)

```typescript
// /src/middleware.ts

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login/register
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
```

---

## 10. Key Implementation Details

### Customer Menu Page (`/[slug]/page.tsx`)

This is the MOST IMPORTANT page. It must:

- **Load in under 2 seconds on a ₹8,000 phone over Jio 4G**
- Be a **Server Component** — fetch restaurant + products on the server
- Use `next/image` with Cloudinary URLs for dish photos (lazy load, WebP, blur placeholder)
- Show category tabs at top (sticky on scroll)
- Show veg / non-veg / Jain filter pills
- Show search bar (client-side filter, no API call)
- Each dish card shows: name, name_hindi (if set), price, veg/non-veg badge, spice dots, image, "Add" button
- Dishes marked `is_available: false` show as greyed out with "Currently Unavailable"
- Popular badge on dishes where `order_count` is in top 10% for that restaurant
- Cart as a floating bottom bar showing item count + total, tapping opens CartSheet (shadcn Sheet)
- Apply restaurant's `primary_color` and `secondary_color` as CSS custom properties

### Kitchen Dashboard (`/dashboard/orders/page.tsx`)

- Subscribe to `orders` table via Supabase Realtime:
  ```typescript
  supabase
    .channel('kitchen-orders')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `restaurant_id=eq.${restaurantId}`,
    }, (payload) => {
      // Update orders state
    })
    .subscribe();
  ```
- Play sound on new order (use `new Audio('/sounds/new-order.mp3').play()`)
- Each order card shows: order number, table number (or "Parcel - Name"), items list, total, time since placed
- Status buttons: Placed → Preparing → Ready → Delivered
- Filter tabs: All | Active | Completed

### Place Order Flow

1. Customer taps "Place Order" in cart
2. Client sends POST to `/api/orders` with order data
3. API route uses `supabaseAdmin` (service role) to insert order + order_items (bypasses RLS since customer is anonymous)
4. API validates with `placeOrderSchema` (Zod)
5. API calculates total server-side (never trust client total)
6. Returns order ID
7. Client redirects to `/[slug]/order/[orderId]` (status page)
8. Status page subscribes to Realtime for that order's status changes

### AI Menu Scanner (`/dashboard/menu/scan/page.tsx`)

1. Owner uploads photo (camera or gallery)
2. Photo sent to `/api/menu-scan`
3. API sends image to Google Gemini Flash with this prompt:
   ```
   Extract all dishes from this restaurant menu image.
   Return a JSON array where each item has:
   - name (string, in English)
   - name_hindi (string, in Hindi/original language if visible, else null)
   - price (number)
   - category (string, e.g., "Starters", "Main Course", "Beverages")
   - is_veg (boolean, true if marked veg or no marking, false if marked non-veg)
   - description (string or null)

   Return ONLY valid JSON. No markdown, no explanation.
   ```
4. API parses Gemini response, validates with Zod
5. Returns structured dish list to client
6. Owner sees editable table of extracted dishes
7. Owner fixes any errors, removes wrong items
8. Owner clicks "Save All" — dishes are batch-inserted into products table

### QR Code Generation (`/dashboard/qr/page.tsx`)

1. Owner sets number of tables (e.g., 15)
2. System generates a row in `tables` for each
3. Each QR encodes URL: `https://yourdomain.com/[slug]?table=[tableId]`
4. Use `qrcode` npm to generate PNG
5. Display all QR codes in a grid with table numbers
6. "Download All" button generates a PDF with all QR codes laid out for printing (one per card, with restaurant name + table number below)

### Auth Flow (Supabase Auth)

**Register:**
1. Collect email, password, restaurant name, phone, city
2. Call `supabase.auth.signUp({ email, password })`
3. On success, insert row into `restaurants` table with the new user's ID
4. Generate slug from restaurant name (slugify + check uniqueness)
5. Redirect to `/dashboard`

**Login:**
1. Call `supabase.auth.signInWithPassword({ email, password })`
2. Redirect to `/dashboard`

**Logout:**
1. Call `supabase.auth.signOut()`
2. Redirect to `/`

---

## 11. Build Order — Step by Step

Tell Claude Code to build in EXACTLY this order. Each step should be a working commit.

### Phase 1: Foundation (do first)
```
Step 1:  Initialize Next.js 14 project with TypeScript, Tailwind, App Router
Step 2:  Install dependencies: @supabase/ssr, @supabase/supabase-js, zod, zustand, date-fns, sonner, qrcode
Step 3:  Set up shadcn/ui (init + install: button, input, card, sheet, dialog, badge, tabs, separator, dropdown-menu, toast, label, textarea, select, table, avatar)
Step 4:  Create Supabase client files (client.ts, server.ts, admin.ts)
Step 5:  Create middleware.ts for auth protection
Step 6:  Create types/index.ts with all interfaces
Step 7:  Create lib/validators.ts with all Zod schemas
Step 8:  Create lib/utils.ts (cn helper, formatPrice as ₹XX, slugify function)
Step 9:  Create lib/constants.ts (ORDER_STATUSES, SPICE_LEVELS, ALLERGEN_OPTIONS, DIET_FILTERS)
```

### Phase 2: Auth + Restaurant Setup
```
Step 10: Build /register page — email, password, restaurant name, phone, city
         On submit: signUp → insert restaurant → redirect to /dashboard
Step 11: Build /login page — email, password
         On submit: signInWithPassword → redirect to /dashboard
Step 12: Build /auth/callback/route.ts for Supabase auth callback
Step 13: Build /dashboard/layout.tsx — sidebar with nav links, auth guard, restaurant context
```

### Phase 3: Menu Management
```
Step 14: Build /dashboard/menu/page.tsx — list all categories + products
         - "Add Category" button → dialog with name + name_hindi
         - Each category is collapsible, shows its dishes
         - "Add Dish" button per category → DishForm dialog
Step 15: Build DishForm component — name, name_hindi, price, description, is_veg, is_jain,
         spice_level, allergens (multi-select), category_id (dropdown)
         Validates with productSchema before saving
Step 16: Add edit + delete for both categories and dishes
Step 17: Add "Nahi hai" toggle — is_available switch on each dish card, instant update
Step 18: Add dish image upload — Cloudinary integration via /api/upload-image
```

### Phase 4: Customer Menu
```
Step 19: Build /[slug]/page.tsx — Server Component
         - Fetch restaurant by slug
         - Fetch all categories + available products
         - Pass to client components
Step 20: Build MenuHeader — restaurant name, logo, colors applied as CSS vars
Step 21: Build CategoryTabs — horizontal scrollable tabs, sticky on scroll
Step 22: Build DishCard — name, hindi name, price, veg badge, spice dots, image, add button
Step 23: Build FilterBar — Veg / Non-veg / Jain pills
Step 24: Build SearchBar — client-side fuzzy filter on name + name_hindi
Step 25: Build Cart (Zustand store) — addItem, removeItem, updateQuantity, updateNotes
Step 26: Build CartSheet (shadcn Sheet) — slides up from bottom, shows items, quantity controls,
         notes input per item, dine-in/parcel toggle, total, "Place Order" button
Step 27: For parcel: show name + phone fields. For dine-in: auto-detect table from URL param
```

### Phase 5: Ordering
```
Step 28: Build POST /api/orders route
         - Validate with placeOrderSchema
         - Use supabaseAdmin to insert order + order_items
         - Calculate total server-side
         - Return { orderId, orderNumber }
Step 29: Build /[slug]/order/page.tsx — cart review + confirm
Step 30: Build /[slug]/order/[orderId]/page.tsx — live order status
         - Show order number, items, total, current status
         - Subscribe to Realtime for status updates on this order
         - Show visual progress: Placed → Preparing → Ready
```

### Phase 6: Kitchen Dashboard
```
Step 31: Build /dashboard/orders/page.tsx
         - Subscribe to Supabase Realtime for orders
         - Show orders as cards sorted by created_at DESC
         - Status buttons to advance order: Placed → Preparing → Ready → Delivered
         - Play sound on new order
         - Filter tabs: All | Active (placed/preparing) | Completed (ready/delivered)
Step 32: Build /dashboard/page.tsx — today's stats
         - Total orders today
         - Revenue today
         - Active orders right now
         - Most ordered dish today
```

### Phase 7: QR Codes
```
Step 33: Build /dashboard/qr/page.tsx
         - Input: number of tables
         - Generate table rows in DB
         - Generate QR code for each table
         - Display grid of QR codes with table numbers
         - "Download All" as PDF for printing
```

### Phase 8: AI Scanner
```
Step 34: Build /api/menu-scan route — receives image, sends to Gemini Flash, returns JSON
Step 35: Build lib/gemini.ts — Gemini Flash API helper with the extraction prompt
Step 36: Build /dashboard/menu/scan/page.tsx
         - Upload photo (drag-drop or camera)
         - Show loading while AI processes
         - Show extracted dishes in editable table
         - Owner can edit, delete, add missing items
         - "Save All" button batch-inserts into products
```

### Phase 9: Settings + Theming
```
Step 37: Build /dashboard/settings/page.tsx
         - Edit restaurant name, phone, address, city, timings
         - Upload logo → extract colors via colorthief → save primary/secondary
         - Preview menu theme with current colors
```

### Phase 10: Production Readiness
```
Step 38: Add Sentry error tracking
Step 39: Add PostHog analytics
Step 40: Add Resend for welcome email on signup
Step 41: Performance audit on customer menu page (Lighthouse, test on slow 4G)
Step 42: Build landing page (/) — hero section, demo screenshot, how it works, CTA
Step 43: Deploy to Vercel with custom domain
```

---

## 12. NPM Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0",
    "date-fns": "^3.6.0",
    "sonner": "^1.5.0",
    "qrcode": "^1.5.4",
    "colorthief": "^2.4.0",
    "cloudinary": "^2.4.0",
    "resend": "^3.5.0",
    "@sentry/nextjs": "^8.0.0",
    "posthog-js": "^1.160.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.400.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/qrcode": "^1.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## 13. Important Rules for Claude Code

1. **Always validate inputs with Zod** — never trust client data
2. **Calculate order totals server-side** — fetch product prices from DB, don't use client-sent prices
3. **Use Server Components by default** — only add `'use client'` when you need interactivity
4. **Never expose SUPABASE_SERVICE_ROLE_KEY to the client** — only use in API routes
5. **Use `supabaseAdmin` (service role) for anonymous operations** like placing orders
6. **Use `createClient()` (anon key) for authenticated operations** where RLS should apply
7. **All prices stored as DECIMAL(10,2)** — display with `formatPrice()` helper
8. **Dish names denormalized in order_items** — so menu edits don't affect past orders
9. **Slug must be unique** — on registration, slugify the restaurant name and append random chars if taken
10. **Customer menu must be fast** — server-render, optimize images, minimize client JS
11. **Sound alert on kitchen dashboard** — `new Audio().play()` on new Realtime event
12. **Mobile-first design** — every page must work perfectly on 360px width screens
13. **Use shadcn/ui components** — don't build custom buttons, inputs, dialogs from scratch
14. **Devanagari script support** — `name_hindi` fields must render correctly (no special font needed, system fonts handle it)
15. **Error states everywhere** — empty states, loading skeletons, error boundaries, toast on failures
