import type { Metadata, Viewport } from 'next';
import { Epilogue, Manrope } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import PostHogProvider from '@/components/PostHogProvider';
import * as Sentry from '@sentry/nextjs';
import './globals.css';

const epilogue = Epilogue({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-epilogue',
});
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
    <html lang="en" className={`${epilogue.variable} ${manrope.variable}`}>
      <body className="antialiased" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <PostHogProvider>
          {children}
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}
