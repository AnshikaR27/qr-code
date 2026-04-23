'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Product, Category } from '@/types';

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  is_veg: boolean;
}

export default function StaffNewOrderPage() {
  const params = useParams();
  const router = useRouter();
  const { staff, restaurant } = useStaff();
  const tableId = params.tableId as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [search, setSearch] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order'),
      supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('sort_order'),
    ]).then(([catRes, prodRes]) => {
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (catRes.data?.[0]) setActiveCategory(catRes.data[0].id);
      setLoading(false);
    });
  }, [restaurant.id]);

  const filteredProducts = useMemo(() => {
    let items = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    } else if (activeCategory) {
      items = items.filter((p) => p.category_id === activeCategory);
    }
    return items;
  }, [products, activeCategory, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        notes: '',
        is_veg: product.is_veg,
      }];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => c.product_id === productId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  }

  function getCartQuantity(productId: string) {
    return cart.find((c) => c.product_id === productId)?.quantity ?? 0;
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/staff/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          table_id: tableId,
          order_type: 'dine_in',
          items: cart.map((c) => ({
            product_id: c.product_id,
            name: c.name,
            price: c.price,
            quantity: c.quantity,
            notes: c.notes || null,
            selected_addons: [],
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to place order');
      }

      const { orderNumber } = await res.json();
      toast.success(`Order #${orderNumber} placed`);
      router.push('/staff-dashboard/tables');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading menu...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold">New Order</h1>
          <p className="text-xs text-muted-foreground">
            Table {tableId.slice(0, 8)}... &middot; by {staff.name}
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Menu */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b">
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Categories */}
          {!search && (
            <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Product list */}
          <div className={cn("flex-1 overflow-y-auto p-3 space-y-2", cart.length > 0 && "pb-24 md:pb-3")}>
            {filteredProducts.map((product) => {
              const qty = getCartQuantity(product.id);
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${
                          product.is_veg ? 'border-green-600' : 'border-red-600'
                        }`}
                      >
                        <span
                          className={`block w-1 h-1 rounded-full m-[2px] ${
                            product.is_veg ? 'bg-green-600' : 'bg-red-600'
                          }`}
                        />
                      </span>
                      <span className="font-medium text-sm truncate">{product.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatPrice(product.price)}</p>
                  </div>

                  {qty === 0 ? (
                    <Button size="sm" variant="outline" onClick={() => addToCart(product)}>
                      Add
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(product.id, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center font-medium text-sm">{qty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(product.id, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart sidebar */}
        {cart.length > 0 && (
          <div className="hidden md:flex w-72 border-l bg-white flex-col">
            <div className="p-4 border-b">
              <h2 className="font-bold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Cart ({cartCount})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-start justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-500"
                      onClick={() => setCart((prev) => prev.filter((c) => c.product_id !== item.product_id))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <Button className="w-full" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing...' : 'Place Order'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile cart bottom bar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between p-3 gap-3">
            <button onClick={() => setShowMobileCart(true)} className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm font-bold truncate">
                {cartCount} item{cartCount !== 1 ? 's' : ''} · {formatPrice(cartTotal)}
              </span>
            </button>
            <Button size="sm" className="flex-shrink-0" onClick={placeOrder} disabled={placing}>
              {placing ? 'Placing...' : 'Place Order'}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile cart sheet */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Cart ({cartCount})
              </h2>
              <button onClick={() => setShowMobileCart(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-start justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500"
                      onClick={() => setCart((prev) => prev.filter((c) => c.product_id !== item.product_id))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t space-y-3 pb-[env(safe-area-inset-bottom)]">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <Button className="w-full" onClick={() => { setShowMobileCart(false); placeOrder(); }} disabled={placing}>
                {placing ? 'Placing...' : 'Place Order'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
