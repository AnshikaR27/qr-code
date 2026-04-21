'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useStaff } from '@/contexts/StaffContext';
import { useOrders } from '@/contexts/OrdersContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Table } from '@/types';

export default function StaffTablesPage() {
  const { restaurant } = useStaff();
  const { orders } = useOrders();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('table_number', { ascending: true })
      .then(({ data }) => {
        if (data) setTables(data as Table[]);
        setLoading(false);
      });
  }, [restaurant.id]);

  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled' && !o.payment_method
  );

  function getTableStatus(tableId: string) {
    const tableOrders = activeOrders.filter((o) => o.table_id === tableId);
    if (tableOrders.length === 0) return 'available';
    return 'occupied';
  }

  function getTableOrderCount(tableId: string) {
    return activeOrders.filter((o) => o.table_id === tableId).length;
  }

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading tables...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-sm text-muted-foreground mt-1">Tap a table to place an order</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {tables.map((table) => {
          const status = getTableStatus(table.id);
          const orderCount = getTableOrderCount(table.id);

          return (
            <Link
              key={table.id}
              href={`/staff-dashboard/tables/${table.id}/new-order`}
              className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all hover:shadow-md ${
                status === 'occupied'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-primary'
              }`}
            >
              <span className="text-lg font-bold">
                {table.display_name || `#${table.table_number}`}
              </span>
              {status === 'occupied' ? (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {orderCount} order{orderCount !== 1 ? 's' : ''}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground mt-2">Available</span>
              )}
              <Plus className="absolute top-2 right-2 w-4 h-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tables found. Ask the owner to set up tables first.
        </div>
      )}
    </div>
  );
}
