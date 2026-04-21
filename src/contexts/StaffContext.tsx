'use client';

import { createContext, useContext } from 'react';
import type { StaffSession, Restaurant } from '@/types';

interface StaffContextValue {
  staff: StaffSession;
  restaurant: Restaurant;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used within StaffProvider');
  return ctx;
}

interface Props {
  staff: StaffSession;
  restaurant: Restaurant;
  children: React.ReactNode;
}

export function StaffProvider({ staff, restaurant, children }: Props) {
  return (
    <StaffContext.Provider value={{ staff, restaurant }}>
      {children}
    </StaffContext.Provider>
  );
}
