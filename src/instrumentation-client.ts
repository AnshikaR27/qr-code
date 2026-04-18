import * as Sentry from "@sentry/nextjs";

function initSentry() {
  Sentry.init({
    dsn: "https://85769a6ebf431517b8d9505f3e740f80@o4511087345270784.ingest.us.sentry.io/4511087367618560",
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: true,
  });
}

function isCustomerRoute(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/dashboard')) return false;
  if (pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/register')) return false;
  if (pathname.startsWith('/auth')) return false;
  if (pathname.startsWith('/monitoring')) return false;
  return true;
}

if (typeof window !== 'undefined' && isCustomerRoute(window.location.pathname)) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initSentry);
  } else {
    setTimeout(initSentry, 1);
  }
} else {
  initSentry();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
