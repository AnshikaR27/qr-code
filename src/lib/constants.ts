import type { OrderStatus, SpiceLevel } from '@/types';

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'placed', label: 'Placed', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'preparing', label: 'Preparing', color: 'bg-blue-100 text-blue-800' },
  { value: 'ready', label: 'Ready', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export const SPICE_LEVELS: { value: SpiceLevel; label: string; emoji: string }[] = [
  { value: 0, label: 'No Spice', emoji: '' },
  { value: 1, label: 'Mild', emoji: '🌶️' },
  { value: 2, label: 'Medium', emoji: '🌶️🌶️' },
  { value: 3, label: 'Hot', emoji: '🌶️🌶️🌶️' },
];

export const ALLERGEN_OPTIONS = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'soy', label: 'Soy' },
  { value: 'egg', label: 'Egg' },
];

export const DIET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'veg', label: 'Veg' },
  { value: 'non_veg', label: 'Non-Veg' },
  { value: 'jain', label: 'Jain' },
] as const;

export type DietFilter = typeof DIET_FILTERS[number]['value'];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const TAX_CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: 'food',             label: 'Prepared Food',     hint: "Restaurant's chosen GST rate (5% or 18%)" },
  { value: 'packaged',         label: 'Packaged Item',     hint: 'Always 18% GST — bottled water, chips, etc.' },
  { value: 'beverage_aerated', label: 'Aerated Beverage',  hint: 'Always 18% GST — soft drinks, mocktails' },
];
