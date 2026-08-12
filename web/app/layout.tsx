import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Plumbline Console: Bid Review and Leveling',
  description:
    'Review extracted subcontractor bids against their source documents, weight scope by importance, and watch the leveled ranking recompute.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
