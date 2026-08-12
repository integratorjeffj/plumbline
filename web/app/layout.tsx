import type { Metadata } from 'next';
import './globals.css';
import { PrefsProvider } from '@/lib/prefs';
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
        <PrefsProvider>
          <AppShell>{children}</AppShell>
        </PrefsProvider>
      </body>
    </html>
  );
}
