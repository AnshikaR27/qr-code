import { create } from 'zustand';
import type { CartItem, CartStore, Product } from '@/types';

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product) => {
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + 1 }
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

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));
