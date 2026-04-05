import { create } from 'zustand';
import type { CartAddon, CartItem, CartStore, Product } from '@/types';

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product, addons: CartAddon[] = []) => {
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + 1, addons: addons.length > 0 ? addons : i.addons }
              : i
          ),
        };
      }
      const newItem: CartItem = {
        product_id: product.id,
        name: product.name,
        name_hindi: product.name_hindi,
        price: product.price,
        quantity: 1,
        notes: '',
        is_veg: product.is_veg,
        addons,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.product_id !== productId),
    }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.product_id === productId ? { ...i, quantity } : i
      ),
    }));
  },

  updateNotes: (productId: string, notes: string) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.product_id === productId ? { ...i, notes } : i
      ),
    }));
  },

  updateAddons: (productId: string, addons: CartAddon[]) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.product_id === productId ? { ...i, addons } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    return get().items.reduce((sum, i) => {
      const addonTotal = i.addons.reduce((a, addon) => a + addon.price, 0);
      return sum + (i.price + addonTotal) * i.quantity;
    }, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));
