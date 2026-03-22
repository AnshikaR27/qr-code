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
