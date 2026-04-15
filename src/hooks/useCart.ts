import { create } from 'zustand';
import type { CartAddon, CartItem, CartStore, Product, SelectedAddon } from '@/types';

/**
 * Build a stable cart key that uniquely identifies a product+addon combination.
 * Same product with different add-ons = different cart lines (Zomato style).
 */
function buildCartKey(productId: string, selectedAddons: SelectedAddon[]): string {
  if (selectedAddons.length === 0) return productId;
  const sorted = [...selectedAddons]
    .sort((a, b) => a.addon_item_id.localeCompare(b.addon_item_id))
    .map((a) => a.addon_item_id)
    .join('|');
  return `${productId}:${sorted}`;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product, addons: CartAddon[] = [], selectedAddons: SelectedAddon[] = []) => {
    set((state) => {
      const key = buildCartKey(product.id, selectedAddons);
      const existing = state.items.find((i) => i.cart_key === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.cart_key === key ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      const newItem: CartItem = {
        cart_key: key,
        product_id: product.id,
        name: product.name,
        name_hindi: product.name_hindi,
        price: product.price,
        quantity: 1,
        notes: '',
        is_veg: product.is_veg,
        addons,
        selected_addons: selectedAddons,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (cartKey: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.cart_key !== cartKey),
    }));
  },

  updateQuantity: (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(cartKey);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.cart_key === cartKey ? { ...i, quantity } : i
      ),
    }));
  },

  updateNotes: (cartKey: string, notes: string) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.cart_key === cartKey ? { ...i, notes } : i
      ),
    }));
  },

  updateAddons: (cartKey: string, addons: CartAddon[]) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.cart_key === cartKey ? { ...i, addons } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    return get().items.reduce((sum, i) => {
      const legacyAddonTotal = i.addons.reduce((a, addon) => a + addon.price, 0);
      const newAddonTotal = i.selected_addons.reduce((a, addon) => a + addon.price, 0);
      return sum + (i.price + legacyAddonTotal + newAddonTotal) * i.quantity;
    }, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  getProductCount: (productId: string) => {
    return get().items
      .filter((i) => i.product_id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  },
}));
