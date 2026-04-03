// ─── Printer ──────────────────────────────────────────────────────────────────

export type PrinterConnectionType = 'usb' | 'network' | 'browser';

export interface PrinterDevice {
  id: string;
  name: string;
  type: PrinterConnectionType;
  ip?: string;
  port?: number;
  paper_width: '80mm' | '58mm';
  auto_cut: boolean;
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
  stitch_project_id: string | null;
  design_tokens: Record<string, string> | null;
  floor_plan: FloorPlan | null;
  billing_config: BillingConfig | null;
  printer_config: PrinterConfig | null;
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
  tax_category: TaxCategory;
}

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: number;
  display_name?: string | null;
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
  internal_notes?: OrderNote[];
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
  name_hindi: string | null;
  price: number;
  quantity: number;
  notes: string | null;
  category_name: string | null;
  tax_category: TaxCategory;
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
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}
