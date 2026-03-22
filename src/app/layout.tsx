import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import PostHogProvider from '@/components/PostHogProvider';
import * as Sentry from '@sentry/nextjs';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export function generateMetadata(): Metadata {
  return {
    title: 'MenuQR — Digital Menu for Restaurants',
    description: 'Upload your menu, get a QR code, customers order from their phones.',
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <PostHogProvider>
          {children}
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}
