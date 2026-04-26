// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffRole = 'floor' | 'kitchen' | 'counter' | 'manager';

export interface StaffMember {
  id: string;
  restaurant_id: string;
  name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffSession {
  staff_id: string;
  restaurant_id: string;
  restaurant_slug: string;
  name: string;
  role: StaffRole;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActorType = 'owner' | 'staff' | 'customer' | 'system';

export interface ActivityLogEntry {
  id: string;
  restaurant_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Printer ──────────────────────────────────────────────────────────────────

export type PrinterConnectionType = 'usb' | 'network' | 'browser' | 'serial';

export interface PrinterDevice {
  id: string;
  name: string;
  type: PrinterConnectionType;
  ip?: string;
  port?: number;
  paper_width: '80mm' | '58mm';
  auto_cut: boolean;
  // USB pairing info — saved after first requestDevice() so reconnect can match by VID/PID
  vendor_id?: number;
  product_id?: number;
  serial_number?: string;
  // Serial port baud rate (for 'serial' type)
  baud_rate?: number;
}

export interface PrinterConfig {
  printers: PrinterDevice[];
  /** 'station_routing' = split by category rules; any other string = a specific printer UUID */
  kot_printer_mode: 'station_routing' | string;
  kot_default_printer: string | null;   // used when kot_printer_mode !== 'station_routing'
  bill_printer: string | null;
  station_routing: Record<string, string>; // category_name → printer id
  auto_print_kot: boolean;
  auto_print_bill: boolean;
  /** 'on_order' = print KOT the moment customer places order; 'on_accept' = print when staff accepts (default) */
  kot_print_trigger: 'on_order' | 'on_accept';
  copies_kot: 1 | 2;
  copies_bill: 1 | 2;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type TaxCategory = 'food' | 'packaged' | 'beverage_aerated';

export interface BillingConfig {
  gstin: string;
  fssai: string;
  gst_rate: 5 | 18;
  service_charge_enabled: boolean;
  service_charge_percent: number;
  sac_code: string;
  legal_name: string;
  billing_address: string;
  state: string;
}

// ─── Floor plan ───────────────────────────────────────────────────────────────

export type FloorShape    = 'round' | 'square';
export type FloorCapacity = 2 | 4 | 6 | 8;

export interface FloorTable {
  /** Same UUID as tables.id — keeps floor plan in sync with orders */
  id: string;
  table_number: number;
  /** Human-readable label shown in the UI (e.g. "L1", "VIP2"). Falls back to #table_number when null. */
  display_name: string | null;
  x: number;
  y: number;
  shape: FloorShape;
  capacity: FloorCapacity;
  /** IDs of other tables this table is merged with */
  merged_with?: string[] | null;
  /** Shared UUID for all tables in a merge group */
  merge_group_id?: string | null;
}

export interface FloorLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface FloorPlan {
  tables: FloorTable[];
  labels: FloorLabel[];
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface OrderNote {
  id: string;
  text: string;
  created_at: string;
}

export type OrderType = 'dine_in' | 'parcel';
export type OrderStatus = 'placed' | 'ready' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'upi' | 'card';
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
  hero_image_url: string | null;
  tagline: string | null;
  stitch_project_id: string | null;
  design_tokens: Record<string, string> | null;
  floor_plan: FloorPlan | null;
  billing_config: BillingConfig | null;
  printer_config: PrinterConfig | null;
  ui_theme: 'classic' | 'sunday';
  service_mode: 'self_service' | 'table_service';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  name_hindi: string | null;
  sort_order: number;
  parent_category_id: string | null;
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
  is_jain: boolean | string;
  spice_level: SpiceLevel;
  allergens: string[];
  dietary_tags: string | null;
  is_available: boolean;
  sort_order: number;
  order_count: number;
  tax_category: TaxCategory;
}

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: number;
  display_name?: string | null;
  qr_code_url: string | null;
  merged_with?: string[] | null;
  merge_group_id?: string | null;
}

export type OrderItemStatus = 'active' | 'voided';

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_type: OrderType;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_methods: SplitPayment[] | null;
  discount_amount: number | null;
  discount_type: 'flat' | 'percentage' | null;
  discount_before_tax: boolean;
  total: number;
  notes: string | null;
  internal_notes?: OrderNote[];
  order_number: number;
  created_at: string;
  updated_at: string;
  /** Shared UUID for orders merged for combined billing (set from Orders tab) */
  merge_group_id?: string | null;
  placed_by_staff_id?: string | null;
  // joined
  items?: OrderItem[];
  table?: Table;
  placed_by_staff?: StaffMember | null;
}

export interface SplitPayment {
  method: PaymentMethod;
  amount: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  name_hindi: string | null;
  price: number;
  quantity: number;
  notes: string | null;
  category_name: string | null;
  tax_category: TaxCategory;
  selected_addons: SelectedAddon[];
  status: OrderItemStatus;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  original_quantity: number | null;
}

// ─── Add-ons ──────────────────────────────────────────────────────────────────

export interface AddonGroup {
  id: string;
  restaurant_id: string;
  name: string;
  selection_type: 'checkbox' | 'radio';
  is_required: boolean;
  max_selections: number | null;
  sort_order: number;
  created_at: string;
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

// Cart (client-side only, Zustand store)
// CartAddon is the legacy product-based add-on (child categories). Kept for backwards compat.
export interface CartAddon {
  product_id: string;
  name: string;
  price: number;
}

export interface CartItem {
  /** Unique key — product_id + JSON of selected_addons so same dish with different addons = separate lines */
  cart_key: string;
  product_id: string;
  name: string;
  name_hindi: string | null;
  price: number;
  quantity: number;
  notes: string;
  is_veg: boolean;
  /** Legacy child-category addons (kept for backwards compat with DishDetailSheetV2) */
  addons: CartAddon[];
  /** New structured add-ons from addon_groups / addon_items */
  selected_addons: SelectedAddon[];
}

export type WaiterCallStatus = 'pending' | 'acknowledged';

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  status: WaiterCallStatus;
  created_at: string;
  // joined
  table?: Table;
}

export interface CartStore {
  items: CartItem[];
  addItem: (product: Product, addons?: CartAddon[], selectedAddons?: SelectedAddon[]) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  updateNotes: (cartKey: string, notes: string) => void;
  updateAddons: (cartKey: string, addons: CartAddon[]) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  /** Returns total quantity of a product across ALL addon variations */
  getProductCount: (productId: string) => number;
}
