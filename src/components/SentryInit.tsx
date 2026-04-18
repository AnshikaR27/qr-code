'use client';

import { useEffect } from 'react';

export default function SentryInit() {
  useEffect(() => {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn: "https://85769a6ebf431517b8d9505f3e740f80@o4511087345270784.ingest.us.sentry.io/4511087367618560",
        integrations: [],
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        enableLogs: true,
        sendDefaultPii: true,
      });
    });
  }, []);

  return null;
}
