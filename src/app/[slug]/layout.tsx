import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: restaurant } = await supabasePublic
    .from('restaurants')
    .select('logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  return {
    manifest: `/api/manifest/${slug}`,
    icons: restaurant?.logo_url
      ? { apple: [{ url: restaurant.logo_url, sizes: '180x180' }] }
      : undefined,
  };
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: '#fdf9f0' }}
    >
      {children}
    </div>
  );
}
