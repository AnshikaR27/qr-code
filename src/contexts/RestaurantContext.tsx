'use client';

import { createContext, useContext } from 'react';
import type { Restaurant } from '@/types';

const RestaurantContext = createContext<Restaurant | null>(null);

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}

export function RestaurantProvider({
  restaurant,
  children,
}: {
  restaurant: Restaurant;
  children: React.ReactNode;
}) {
  return (
    <RestaurantContext.Provider value={restaurant}>
      {children}
    </RestaurantContext.Provider>
  );
}
