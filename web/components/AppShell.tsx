'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { usePrefs } from '@/lib/prefs';
import { PROJECT_IDS, getProject } from '@/lib/projects';
import { verifyAgainstPipeline } from '@/lib/leveling';
import { Plumb } from './Plumb';

const ROUTE_TABS = [
  { segment: '', label: 'Overview' },
  { segment: 'review', label: 'Review' },
  { segment: 'compare', label: 'Compare' },
  { segment: 'settings', label: 'Scope & weighting' },
  { segment: 'sources', label: 'Data sources' },
  { segment: 'report', label: 'Stakeholder report' },
];

/**
 * Renders both outside and inside a project (the Directory route has no
 * project at all), so it resolves project identity itself from the URL and
 * the static manifest rather than depending on ProjectStoreProvider -- that
 * provider only wraps /p/[projectId]/*, and the masthead needs to work above
 * it too.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, mode } = usePrefs();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId;
  const project = projectId ? getProject(projectId) : undefined;

  const parity = useMemo(
    () => (project ? verifyAgainstPipeline(project) : null),
    [project]
  );

  const isActive = (href: string) =>
    href === `/p/${projectId}/` ? pathname === href : pathname.startsWith(href);

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

            {project && projectId && (
              <select
                className="project-switch"
                value={projectId}
                onChange={(e) => router.push(`/p/${e.target.value}/`)}
                aria-label="Switch project"
              >
                {PROJECT_IDS.map((id) => {
                  const p = getProject(id)!;
                  return (
                    <option key={id} value={id}>
                      {p.project.project_name} · {p.project.bid_package_number}
                    </option>
                  );
                })}
              </select>
            )}

            <div className="masthead-spacer" />

            {parity && !parity.ok && (
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

          {project && projectId && (
            <nav className="nav">
              {ROUTE_TABS.map((route) => {
                const href = `/p/${projectId}/${route.segment ? `${route.segment}/` : ''}`;
                return (
                  <Link key={route.segment} href={href} data-active={isActive(href)}>
                    {route.label}
                  </Link>
                );
              })}
            </nav>
          )}
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
