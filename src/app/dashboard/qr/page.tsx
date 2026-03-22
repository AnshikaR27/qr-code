import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import QRManager from './QRManager';
import type { Restaurant, Table } from '@/types';

export default async function QrPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!restaurant) redirect('/register');

  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('table_number', { ascending: true });

  return (
    <QRManager
      restaurant={restaurant as Restaurant}
      initialTables={(tables ?? []) as Table[]}
    />
  );
}
