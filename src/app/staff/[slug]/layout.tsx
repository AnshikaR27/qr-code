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
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  const name = restaurant?.name ?? 'Staff Login';
  const hasLogo = !!restaurant?.logo_url;

  return {
    manifest: `/api/manifest/${slug}?staff=1`,
    themeColor: '#09090b',
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
      'apple-mobile-web-app-status-bar-style': 'default',
      'mobile-web-app-capable': 'yes',
    },
    icons: hasLogo
      ? {
          apple: [{ url: `/api/cafe-icon/${slug}?size=180&v=2`, sizes: '180x180' }],
          icon: [
            { url: `/api/cafe-icon/${slug}?size=192&v=2`, sizes: '192x192', type: 'image/png' },
            { url: `/api/cafe-icon/${slug}?size=512&v=2`, sizes: '512x512', type: 'image/png' },
          ],
        }
      : { icon: [{ url: '/favicon.ico' }] },
  };
}

export default function StaffSlugLayout({ children }: Props) {
  return <>{children}</>;
}
