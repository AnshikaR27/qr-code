import * as Sentry from '@sentry/nextjs';

const isCustomerRoute =
  typeof window !== 'undefined' &&
  /^\/[^/]+\/(menu|order)/.test(window.location.pathname);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  integrations: [],
  enabled: process.env.NODE_ENV === 'production' && !isCustomerRoute,
});