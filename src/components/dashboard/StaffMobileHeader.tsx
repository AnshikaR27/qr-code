'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChefHat } from 'lucide-react';
import { useStaff } from '@/contexts/StaffContext';
import { hasPermission } from '@/lib/staff-permissions';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import ItemAvailabilityModal from './ItemAvailabilityModal';

export default function StaffMobileHeader() {
  const { staff, restaurant } = useStaff();
  const canStock = hasPermission(staff.role, 'menu:mark_out_of_stock');

  const [eightySixOpen, setEightySixOpen] = useState(false);
  const [unavailableCount, setUnavailableCount] = useState(0);

  const fetchUnavailableCount = useCallback(async () => {
    if (!canStock) return;
    const supabase = createClient();
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', false);
    setUnavailableCount(count ?? 0);
  }, [canStock, restaurant.id]);

  useEffect(() => {
    fetchUnavailableCount();

    if (!canStock) return;
    const supabase = createClient();
    const channel = supabase
      .channel('header-86-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `restaurant_id=eq.${restaurant.id}` },
        () => fetchUnavailableCount(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [canStock, restaurant.id, fetchUnavailableCount]);

  return (
    <>
      <div className="md:hidden px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">{restaurant.name}</p>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-base truncate">{staff.name}</p>
            <Badge variant="outline" className="text-[10px] capitalize">{staff.role}</Badge>
          </div>
        </div>

        {canStock && (
          <button
            onClick={() => setEightySixOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ChefHat className="w-4 h-4" />
            <span className="hidden sm:inline">86 List</span>
            {unavailableCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {unavailableCount}
              </span>
            )}
          </button>
        )}
      </div>

      {canStock && (
        <ItemAvailabilityModal
          open={eightySixOpen}
          onOpenChange={(open) => {
            setEightySixOpen(open);
            if (!open) fetchUnavailableCount();
          }}
          restaurantId={restaurant.id}
        />
      )}
    </>
  );
}
