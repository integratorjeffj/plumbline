'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { usePrefs } from '@/lib/prefs';
import { useShell } from '@/lib/shell';
import { PROJECT_IDS, getProject } from '@/lib/projects';
import { verifyAgainstPipeline } from '@/lib/leveling';
import { Plumb } from './Plumb';
import { Icon, type IconName } from './Icons';

const ROUTE_TABS = [
  { segment: '', label: 'Overview' },
  { segment: 'review', label: 'Review' },
  { segment: 'compare', label: 'Compare' },
  { segment: 'vendors', label: 'Prequalification' },
  { segment: 'award', label: 'Award' },
  { segment: 'settings', label: 'Scope & weighting' },
  { segment: 'sources', label: 'Data sources' },
  { segment: 'report', label: 'Stakeholder report' },
];

const PROGRAM_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Bid packages', icon: 'packages' },
  { href: '/findings/', label: 'Findings', icon: 'findings' },
  { href: '/scope-matrix/', label: 'Scope matrix', icon: 'matrix' },
  { href: '/vendors/', label: 'Vendors', icon: 'vendors' },
  { href: '/settings/', label: 'Settings', icon: 'settings' },
];

const COLLAPSE_BELOW_PX = 1024;
const DRAWER_BELOW_PX = 768;

/**
 * Renders both outside and inside a project (the Bid packages route has no
 * project at all), so it resolves project identity itself from the URL and
 * the static manifest rather than depending on ProjectStoreProvider -- that
 * provider only wraps /p/[projectId]/*, and the shell needs to work above it.
 *
 * The sidebar has three states rather than two, because a 232px rail that is
 * merely narrower still costs a phone a third of its width: expanded and
 * icon-only are the two desktop states, and below 768px the rail leaves the
 * flow entirely and returns as a drawer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, mode } = usePrefs();
  const { query, setQuery } = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId;
  const project = projectId ? getProject(projectId) : undefined;

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Read once after mount rather than on every resize: this decides the
  // opening state, and a reviewer who has since chosen a width should keep it
  // even if they drag the window across the breakpoint.
  useEffect(() => {
    if (window.innerWidth < COLLAPSE_BELOW_PX) setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const parity = useMemo(() => (project ? verifyAgainstPipeline(project) : null), [project]);

  const isProjectRoute = pathname.startsWith('/p/');
  const activeTab = ROUTE_TABS.find((tab) =>
    tab.segment
      ? pathname.startsWith(`/p/${projectId}/${tab.segment}/`)
      : pathname === `/p/${projectId}/`
  );

  const isNavActive = (href: string) =>
    href === '/' ? pathname === '/' || isProjectRoute : pathname.startsWith(href);

  const closeDrawer = () => setDrawerOpen(false);

  const onSearch = (value: string) => {
    setQuery(value);
    // The search box is global but the thing it filters is the package table,
    // so typing anywhere else takes the reviewer to where results can show.
    if (value && pathname !== '/') router.push('/');
  };

  const breadcrumb: { label: string; href?: string }[] = [{ label: 'Program' }];
  if (isProjectRoute && project && projectId) {
    breadcrumb.push({ label: 'Bid packages', href: '/' });
    breadcrumb.push({ label: project.project.project_name, href: `/p/${projectId}/` });
    if (activeTab?.segment) breadcrumb.push({ label: activeTab.label });
  } else {
    breadcrumb.push({ label: PROGRAM_NAV.find((n) => isNavActive(n.href))?.label ?? 'Bid packages' });
  }

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

      <div className="shell" data-collapsed={collapsed} data-drawer={drawerOpen}>
        <button
          className="sidebar-scrim"
          type="button"
          tabIndex={drawerOpen ? 0 : -1}
          aria-label="Close navigation"
          onClick={closeDrawer}
        />

        <aside className="sidebar" aria-label="Primary navigation">
          <div className="sidebar-brand">
            <Link href="/" className="mark" onClick={closeDrawer} aria-label="Plumbline home">
              <Plumb size={24} />
              <span className="wordmark sidebar-label">
                Plumb<span>line</span>
              </span>
            </Link>
          </div>

          <nav className="sidebar-nav">
            {PROGRAM_NAV.map((item) => {
              const active = isNavActive(item.href);
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="sidebar-link"
                    data-active={active}
                    onClick={closeDrawer}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    <span className="sidebar-label">{item.label}</span>
                  </Link>

                  {item.href === '/' && active && projectId && project && (
                    <div className="sidebar-sub sidebar-label">
                      <div className="sidebar-sub-head">{project.project.bid_package_number}</div>
                      {ROUTE_TABS.map((tab) => {
                        const href = `/p/${projectId}/${tab.segment ? `${tab.segment}/` : ''}`;
                        return (
                          <Link
                            key={tab.segment}
                            href={href}
                            className="sidebar-sublink"
                            data-active={activeTab?.segment === tab.segment}
                            onClick={closeDrawer}
                          >
                            {tab.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
          >
            <span className="sidebar-collapse-caret">
              <Icon name="chevron" />
            </span>
            <span className="sidebar-label">Collapse</span>
          </button>
        </aside>

        <div className="shell-main">
          <header className="topbar">
            <button
              className="btn topbar-menu"
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>

            <nav className="crumbs" aria-label="Breadcrumb">
              {breadcrumb.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="crumb">
                  {i > 0 && <span className="crumb-sep">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>

            <div className="topbar-search">
              <span className="topbar-search-icon">
                <Icon name="search" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search bid packages"
                aria-label="Search bid packages"
              />
            </div>

            <span className="freshness" title="Every figure is recomputed by the leveling engine on page load">
              <Icon name="clock" />
              <span>Synthetic data, generated at load</span>
            </span>

            {parity && !parity.ok && (
              <span className="pill p-danger" title="Client leveling disagrees with the pipeline export">
                parity failed
              </span>
            )}

            {project && projectId && (
              <select
                className="project-switch"
                value={projectId}
                onChange={(e) => router.push(`/p/${e.target.value}/`)}
                aria-label="Switch bid package"
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

            <button
              className="btn"
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </header>

          <main className="wrap page">{children}</main>

          <footer className="wrap" style={{ paddingBottom: 40 }}>
            <div className="note">
              <b>Human review required.</b> This console is decision support. It never awards a bid,
              and every AI-extracted value carries a citation back to the page and section it came
              from so a reviewer can check it against the source.
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
