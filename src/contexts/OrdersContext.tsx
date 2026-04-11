'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';

interface OrdersContextValue {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  refreshOrders: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}

interface Props {
  restaurantId: string;
  initialOrders: Order[];
  children: React.ReactNode;
}

export function OrdersProvider({ restaurantId, initialOrders, children }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const isFirstRender = useRef(true);

  const refreshOrders = useCallback(async () => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*), table:tables(*)')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
  }, [restaurantId]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`layout-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isFirstRender.current) return;
            const { data } = await supabase
              .from('orders')
              .select('*, items:order_items(*), table:tables(*)')
              .eq('id', payload.new.id)
              .single();
            if (data) {
              const newOrder = data as Order;
              setOrders((prev) => [newOrder, ...prev]);
              console.log(`[orders-ctx] New order #${newOrder.order_number}`);
            }
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        },
      )
      .subscribe((status) => { console.log('[orders-ctx] subscription status:', status); });

    isFirstRender.current = false;
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  return (
    <OrdersContext.Provider value={{ orders, setOrders, refreshOrders }}>
      {children}
    </OrdersContext.Provider>
  );
}
