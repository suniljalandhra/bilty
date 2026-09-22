import type { Metadata } from 'next';
import { SessionProvider } from '@/components/session';
import './globals.css';
import './night-dispatch.css';
export const metadata: Metadata = {
  title: { default: 'Bilty · Transport workspace', template: '%s · Bilty' },
  description: 'Your company’s digital bilty book.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
