'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Plumb } from './Plumb';

const ROUTES = [
  { href: '/', label: 'Overview' },
  { href: '/review/', label: 'Review' },
  { href: '/compare/', label: 'Compare' },
  { href: '/settings/', label: 'Scope & weighting' },
  { href: '/sources/', label: 'Data sources' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, mode, data, parity } = useStore();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, ''));

  return (
    <>
      <div className="demo-banner">
        {mode === 'demo' ? (
          <>
            <b>Demo data.</b> Every company, person, price, and document is synthetic. No real bid
            data is represented.
          </>
        ) : (
          <>
            <b>Live mode.</b> Connect a mailbox or upload a document on the Data sources page.
          </>
        )}
      </div>

      <header className="masthead">
        <div className="wrap">
          <div className="masthead-row">
            <Link href="/" className="mark" style={{ color: 'var(--ink)' }}>
              <Plumb size={28} />
              <span className="wordmark">
                Plumb<span>line</span>
              </span>
            </Link>
            <div className="mark-sub">
              {data.project.project_name} · {data.project.bid_package_number}
            </div>

            <div className="masthead-spacer" />

            {!parity.ok && (
              <span className="pill p-danger" title="Client leveling disagrees with the pipeline export">
                parity failed
              </span>
            )}
            <button
              className="btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <nav className="nav">
            {ROUTES.map((route) => (
              <Link key={route.href} href={route.href} data-active={isActive(route.href)}>
                {route.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap page">{children}</main>

      <footer className="wrap" style={{ paddingBottom: 40 }}>
        <div className="note">
          <b>Human review required.</b> This console is decision support. It never awards a bid, and
          every AI-extracted value carries a citation back to the page and section it came from so a
          reviewer can check it against the source.
        </div>
      </footer>
    </>
  );
}
