import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import Script from 'next/script';

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

  const name = restaurant?.name ?? 'Menu';
  const logoUrl = restaurant?.logo_url ?? undefined;

  return {
    manifest: `/api/manifest/${slug}`,
    title: name,
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
      'apple-mobile-web-app-status-bar-style': 'default',
      'mobile-web-app-capable': 'yes',
    },
    themeColor: '#fdf9f0',
    icons: logoUrl
      ? {
          apple: [{ url: logoUrl, sizes: '180x180' }],
          icon: [
            { url: logoUrl, sizes: '192x192', type: 'image/png' },
            { url: logoUrl, sizes: '512x512', type: 'image/png' },
          ],
        }
      : undefined,
  };
}

export default function SlugLayout({ children }: Props) {
  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: '#fdf9f0' }}>
      {children}
      <Script id="register-sw" strategy="afterInteractive">
        {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`}
      </Script>
    </div>
  );
}
