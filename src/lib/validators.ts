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
    selected_addons: z.array(z.object({
      addon_item_id: z.string().uuid(),
      name: z.string(),
      price: z.number().min(0),
    })).optional().default([]),
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

export const staffLoginSchema = z.object({
  restaurant_slug: z.string().min(1),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
});

export const staffCreateSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
  role: z.enum(['waiter', 'kitchen', 'both']),
});

export const staffUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
  role: z.enum(['waiter', 'kitchen', 'both']).optional(),
  is_active: z.boolean().optional(),
});

export const voidItemSchema = z.object({
  order_item_id: z.string().uuid(),
  reason: z.string().min(1).max(300),
  action: z.enum(['void', 'reduce']),
  new_quantity: z.number().int().positive().optional(),
}).refine(
  (data) => data.action !== 'reduce' || (data.new_quantity !== undefined && data.new_quantity > 0),
  { message: 'new_quantity is required when reducing', path: ['new_quantity'] }
);

export const restaurantSettingsSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  opening_time: z.string().optional(),
  closing_time: z.string().optional(),
  stitch_project_id: z.string().optional().nullable(),
});
