# Task: Build Zomato/Swiggy-style add-ons & customization system

## Context

This is a QR code restaurant ordering system built with Next.js (App Router), Supabase (Postgres + Realtime), Tailwind CSS, and shadcn/ui components. Restaurants create menus, customers scan a QR code at the table, browse the menu, place orders, and the kitchen sees them on a dashboard.

Right now, when a customer taps "Add" on a dish, it goes straight to the cart. I need to add a customization step — like Zomato/Swiggy — where a bottom sheet pops up with add-on options (Extra Cheese +₹30, Choose Size, Choose Sauce, etc.) before adding to cart.

## Before you start — read these files first

1. Read the full database schema — check `supabase/migrations/` for all migration files to understand existing tables (`products`, `categories`, `order_items`, `orders`, `restaurants`)
2. Read the current cart/ordering flow — find the component where "Add to cart" happens on the customer-facing menu (likely under `src/app/[slug]/` or similar). Understand how items are added to cart state and how orders are submitted to Supabase.
3. Read `src/lib/escpos-kot.ts` or whatever file builds the KOT (Kitchen Order Ticket) print data — you'll need to update it to show add-ons under items.
4. Read `src/lib/escpos-bill.ts` or `src/lib/billing.ts` — the customer bill template. Same update needed.
5. Read `src/components/dashboard/BillingSheet.tsx` — the payment/billing component. It calculates totals.
6. Check if `order_items` already has a `selected_addons` or similar column.
7. Read the menu management page under `src/app/dashboard/menu/` to understand how categories and products are managed.

Then show me a short plan (what tables you'll create, which files you'll modify, the order you'll work in) before writing any code.

## Part 1 — Database migration

Create a new Supabase migration with these tables:

### addon_groups
```sql
create table addon_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,                          -- e.g. "Add-ons", "Choose Size", "Choose Sauce"
  selection_type text not null default 'checkbox' check (selection_type in ('checkbox', 'radio')),
    -- checkbox = pick multiple (Extra Cheese + Extra Patty)
    -- radio = pick exactly one (Regular / Large / XL)
  is_required boolean not null default false,   -- true = customer must pick at least one
  max_selections int,                           -- null = unlimited for checkbox type
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
```

### addon_items
```sql
create table addon_items (
  id uuid primary key default gen_random_uuid(),
  addon_group_id uuid not null references addon_groups(id) on delete cascade,
  name text not null,                           -- e.g. "Extra Cheese", "Large"
  price numeric not null default 0,             -- additional price on top of base dish
  is_veg boolean not null default true,
  is_available boolean not null default true,
  sort_order int not null default 0
);
```

### product_addon_groups (assign a group to specific products)
```sql
create table product_addon_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  addon_group_id uuid not null references addon_groups(id) on delete cascade,
  unique(product_id, addon_group_id)
);
```

### category_addon_groups (assign a group to an entire category — applies to all its products)
```sql
create table category_addon_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  addon_group_id uuid not null references addon_groups(id) on delete cascade,
  unique(category_id, addon_group_id)
);
```

### Alter order_items
```sql
alter table order_items add column if not exists selected_addons jsonb not null default '[]';
```

The `selected_addons` JSON format stored per order item:
```json
[
  {"addon_item_id": "uuid", "name": "Extra Cheese", "price": 30},
  {"addon_item_id": "uuid", "name": "Large", "price": 40}
]
```

### RLS policies
- Restaurant owners can CRUD their own addon_groups, addon_items, product_addon_groups, category_addon_groups (where restaurant_id matches their auth.uid or via the product/category's restaurant_id).
- Customers (anonymous/public) can SELECT addon_groups, addon_items, product_addon_groups, category_addon_groups for the restaurant they're browsing.
- order_items.selected_addons follows existing order_items RLS.

### Enable Realtime on addon_groups and addon_items so the dashboard updates live.

## Part 2 — Helper function to resolve add-ons for a product

Create `src/lib/addon-utils.ts` with:

```typescript
async function getAddonGroupsForProduct(supabase, productId: string, categoryId: string): Promise<AddonGroup[]>
```

This function fetches addon groups from TWO sources and merges them:
1. **Direct assignment**: addon groups linked via `product_addon_groups` where product_id matches
2. **Category assignment**: addon groups linked via `category_addon_groups` where category_id matches

Deduplicate by addon_group_id. Return each group with its addon_items included, sorted by sort_order. Define proper TypeScript types for AddonGroup and AddonItem.

## Part 3 — Dashboard UI for managing add-ons

Create a new page/section accessible from the menu management area. Could be a tab on the existing menu page or a separate page at `src/app/dashboard/menu/addons/page.tsx`.

### Features needed:

**Addon group management:**
- Create new group: name input, selection_type toggle (checkbox vs radio), is_required toggle, max_selections number input
- Edit existing groups
- Delete group (with confirmation)
- Reorder groups via drag (use the same @dnd-kit setup already in the project)

**Addon items within a group:**
- Add items: name, price (₹ input), is_veg toggle
- Edit/delete items
- Reorder via drag
- Toggle is_available on/off

**Assign groups to products/categories:**
- A section or modal where the owner can:
  - Pick "Apply to specific dishes" → multi-select from their products list
  - Pick "Apply to entire category" → pick one or more categories
- Show which products/categories each group is currently assigned to
- Allow removing assignments

**Quick presets (nice to have, do this last):**
- Buttons like "Extra Cheese (₹30)", "Size: Regular/Large", "Sauce Choice" that create a pre-filled addon group with one click
- These just pre-fill the create form, the owner can edit before saving

### Design guidelines:
- Match the existing dashboard design language — same card styles, borders, buttons, spacing
- Use shadcn/ui components where they exist in the project
- Use lucide-react icons consistent with the rest of the dashboard

## Part 4 — Customer-facing customization bottom sheet

This is the most important part for UX. When a customer taps "Add" on a dish:

### If the dish has NO addon groups:
- Add to cart immediately (current behavior — don't change this)

### If the dish HAS addon groups:
- Do NOT add to cart. Instead, open a bottom sheet / drawer / modal from the bottom.
- The sheet shows:
  - **Header**: Dish name, base price, image (if available)
  - **Addon sections**: One section per addon_group, in sort_order:
    - Group name as section header (e.g. "Choose your add-ons")
    - Badge: "Required" (red/orange) or "Optional" (gray)
    - For `selection_type: 'radio'`: radio buttons — customer picks exactly one
    - For `selection_type: 'checkbox'`: checkboxes — customer picks 0 to max_selections
    - Each option row shows: veg/non-veg indicator dot, name, "+₹XX" price (or "Included" if price is 0)
    - Gray out unavailable items (is_available: false)
  - **Footer** (sticky at bottom):
    - Quantity selector (- 1 +)
    - Total price = (base_price + sum of selected addon prices) × quantity
    - "Add to cart — ₹XXX" button
    - Button is DISABLED until all required groups have a selection
- Animate the sheet sliding up from bottom (use existing sheet/drawer component if the project has one, or framer-motion)

### If customer taps "+" on an item already in cart:
- Open the customization sheet again (fresh selections). Each cart entry can have different addons — this is how Zomato works. "2x Cheese Maggi" where one has Extra Cheese and the other doesn't = 2 separate cart lines.

### Cart state update:
- Each cart item now needs to store `selected_addons` array alongside the product info
- Two cart items with the same product_id but different addons are SEPARATE line items
- The "item count" badge on the Add button should still show total quantity of that product across all addon variations

## Part 5 — Cart display update

Update the cart component to show addons under each item:

```
Cheese Maggi                         ₹129
  + Extra Cheese                      +₹30
  + Extra Maggi Portion               +₹20
                               Item: ₹179

Cheese Maggi                         ₹129
  (no add-ons)
                               Item: ₹129
```

- Addon lines should be smaller text, indented, muted color
- Each customized combination is its own line in the cart
- "Edit" tap on a cart item should reopen the customization sheet with current selections pre-filled
- Cart total = sum of all (base_price + addon_prices) × quantity per line

## Part 6 — Order submission

When the order is submitted to Supabase, each `order_items` row should include:
- `product_id`, `name`, `quantity`, `price` (BASE price only)
- `selected_addons` (JSONB array with addon_item_id, name, price for each selected addon)
- `notes` (existing field, keep working)

The order `total` on the `orders` table should include addon prices in the calculation.

## Part 7 — KOT (Kitchen Order Ticket) printing

Find the KOT template/builder (likely `src/lib/escpos-kot.ts` or similar). Update it so items with addons print as:

```
1x Cheese Maggi               ₹129
   + Extra Cheese               +₹30
   + Extra Maggi                +₹20
1x Classic Burger              ₹129
```

Addon lines should be indented with smaller or normal font, prefixed with "+ ".

## Part 8 — Customer bill printing

Find the bill template (likely `src/lib/escpos-bill.ts` or `src/lib/billing.ts`). Update it similarly:

```
1x Cheese Maggi                ₹129
   + Extra Cheese                ₹30
   + Extra Maggi                 ₹20
   Subtotal:                    ₹179
1x Classic Burger               ₹129
---------------------------------
Subtotal                        ₹308
```

Also update `BillingSheet.tsx` to include addon prices when calculating totals, discounts, and tax.

## Part 9 — Types

Update `src/types/index.ts` (or wherever types are defined) to add:

```typescript
export interface AddonGroup {
  id: string;
  restaurant_id: string;
  name: string;
  selection_type: 'checkbox' | 'radio';
  is_required: boolean;
  max_selections: number | null;
  sort_order: number;
  items: AddonItem[];
}

export interface AddonItem {
  id: string;
  addon_group_id: string;
  name: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface SelectedAddon {
  addon_item_id: string;
  name: string;
  price: number;
}
```

Update the `OrderItem` type to include `selected_addons: SelectedAddon[]`.

## What NOT to break

- Current ordering flow for dishes without add-ons (must still work with zero addon groups)
- KOT printing for orders placed before this feature exists (selected_addons defaults to [])
- Billing calculations for existing orders
- The menu scanner (ai-scanner.ts) — it now skips addon items like "Extra Cheese", which is correct
- Kitchen dashboard order cards
- Realtime order updates

## Implementation order

1. Migration + types first
2. Helper function (getAddonGroupsForProduct)
3. Dashboard addon management UI
4. Customer-facing bottom sheet
5. Cart display update
6. Order submission update
7. KOT + bill printing update
8. Test the full flow end to end
