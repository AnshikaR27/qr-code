'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Minus, Plus, ShoppingBag, Trash2, X, Clock, CheckCheck, PlusCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { cn, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Product, Category, Order, OrderItem, Table } from '@/types';

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

  const [tableInfo, setTableInfo] = useState<Table | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [search, setSearch] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single(),
      supabase
        .from('orders')
        .select('*, items:order_items(*), table:tables(id, table_number, display_name)')
        .eq('table_id', tableId)
        .in('status', ['placed', 'ready'])
        .is('payment_method', null)
        .order('created_at', { ascending: false }),
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
    ]).then(([tableRes, ordersRes, catRes, prodRes]) => {
      if (tableRes.data) setTableInfo(tableRes.data as Table);
      if (ordersRes.data) {
        setActiveOrders(ordersRes.data as Order[]);
        if ((ordersRes.data as Order[]).length === 0) setShowMenu(true);
      }
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (catRes.data?.[0]) setActiveCategory(catRes.data[0].id);
      setLoading(false);
    });
  }, [restaurant.id, tableId]);

  const tableLabel = tableInfo
    ? (tableInfo.display_name?.trim() || `#${tableInfo.table_number}`)
    : tableId.slice(0, 8);

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
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  // No active orders — show menu directly (original behavior)
  if (showMenu) {
    return (
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-white">
          <Button variant="ghost" size="icon" onClick={() => {
            if (activeOrders.length > 0) { setShowMenu(false); } else { router.back(); }
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold">
              {activeOrders.length > 0 ? 'Add Items' : 'New Order'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Table {tableLabel} &middot; by {staff.name}
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

  // ── Occupied table: show active orders first ──────────────────────────────

  const totalAmount = activeOrders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = activeOrders.reduce(
    (sum, o) => sum + (o.items ?? []).filter(i => i.status !== 'voided').reduce((s, i) => s + i.quantity, 0),
    0,
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold">Table {tableLabel}</h1>
          <p className="text-xs text-muted-foreground">
            {activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {formatPrice(totalAmount)}
          </p>
        </div>
      </div>

      {/* Active orders */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {activeOrders.map((order) => (
          <ActiveOrderCard key={order.id} order={order} />
        ))}
      </div>

      {/* Add items button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          className="w-full py-6 text-base gap-2"
          onClick={() => setShowMenu(true)}
        >
          <PlusCircle className="w-5 h-5" />
          Add items to this table
        </Button>
      </div>
    </div>
  );
}

// ─── Active Order Card ──────────────────────────────────────────────────────

function ActiveOrderCard({ order }: { order: Order }) {
  const activeItems = (order.items ?? []).filter((i) => i.status !== 'voided');
  const orderTotal = activeItems.reduce((sum, i) => {
    const addonTotal = (i.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
    return sum + (i.price + addonTotal) * i.quantity;
  }, 0);

  const isReady = order.status === 'ready';

  return (
    <div className={cn(
      'bg-white rounded-xl border-2 shadow-sm overflow-hidden',
      isReady ? 'border-green-400' : 'border-amber-300',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        isReady ? 'bg-green-50' : 'bg-amber-50',
      )}>
        <div>
          <p className="font-bold text-lg">#{order.order_number}</p>
          {order.customer_name && (
            <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-bold px-2 py-1 rounded-full',
            isReady
              ? 'bg-green-200 text-green-800'
              : 'bg-amber-200 text-amber-800',
          )}>
            {isReady ? (
              <span className="flex items-center gap-1"><CheckCheck className="w-3 h-3" /> READY</span>
            ) : (
              'PREPARING'
            )}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {activeItems.map((item) => {
          const addonTotal = (item.selected_addons ?? []).reduce((s, a) => s + (a.price ?? 0), 0);
          return (
            <div key={item.id}>
              <div className="flex justify-between gap-2">
                <span className="text-sm">
                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatPrice((item.price + addonTotal) * item.quantity)}
                </span>
              </div>
              {(item.selected_addons ?? []).map((addon, ai) => (
                <div key={ai} className="flex justify-between gap-2 pl-5">
                  <span className="text-xs text-muted-foreground">+ {addon.name}</span>
                  {addon.price > 0 && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">+{formatPrice(addon.price)}</span>
                  )}
                </div>
              ))}
              {item.notes && (
                <p className="text-xs text-red-600 font-medium mt-0.5 italic pl-5">
                  &ldquo;{item.notes}&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-gray-50 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''}</span>
        <span className="font-bold text-sm">{formatPrice(orderTotal)}</span>
      </div>
    </div>
  );
}
