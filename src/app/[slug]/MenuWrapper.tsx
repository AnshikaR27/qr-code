'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import SplashScreen from '@/components/menu/SplashScreen';
import { buildMenuTokens } from '@/lib/tokens';
import type { Category, Product, Restaurant } from '@/types';

// CustomerMenu loads in the background while the user views the splash.
// By the time they tap "Order Now" the bundle is almost always ready.
const CustomerMenu = dynamic(() => import('./CustomerMenu'), { ssr: false });

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

export default function MenuWrapper({ restaurant, categories, products, tableId }: Props) {
  const tokens = useMemo(() => buildMenuTokens(restaurant.design_tokens), [restaurant.design_tokens]);

  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return true; // server: always show splash
    return !sessionStorage.getItem(`splash-seen-${restaurant.slug}`);
  });

  function handleEnter() {
    sessionStorage.setItem(`splash-seen-${restaurant.slug}`, '1');
    setShowSplash(false);
  }

  if (showSplash) {
    return <SplashScreen restaurant={restaurant} tokens={tokens} onEnter={handleEnter} />;
  }

  return (
    <CustomerMenu
      restaurant={restaurant}
      categories={categories}
      products={products}
      tableId={tableId}
    />
  );
}
