import type { Metadata } from 'next';
import { SessionProvider } from '@/components/session';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'BiltyBook · Transport workspace', template: '%s · BiltyBook' },
  description: "Your company's digital bilty book.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
