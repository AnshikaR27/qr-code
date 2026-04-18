'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function isCustomerRoute(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/dashboard')) return false;
  if (pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/register')) return false;
  if (pathname.startsWith('/auth')) return false;
  if (pathname.startsWith('/monitoring')) return false;
  return true;
}

let phLoaded = false;

function loadPostHog() {
  if (phLoaded) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';
  if (!key) return;
  phLoaded = true;
  import('posthog-js').then(({ default: ph }) => {
    ph.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
      loaded: (instance) => {
        if (process.env.NODE_ENV !== 'production') instance.opt_out_capturing();
      },
    });
  });
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (phLoaded) return;
    if (isCustomerRoute(pathname)) {
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(loadPostHog);
        return () => cancelIdleCallback(id);
      }
      const id = setTimeout(loadPostHog, 1);
      return () => clearTimeout(id);
    }
    loadPostHog();
  }, [pathname]);

  return <>{children}</>;
}
