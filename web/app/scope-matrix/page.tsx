'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionHead } from '@/components/Bits';
import { Drawer } from '@/components/Drawer';
import { SegmentedBar } from '@/components/Charts';
import { PROJECTS, PROJECT_IDS } from '@/lib/projects';
import { requiredScopeRows, type RequiredScopeRow } from '@/lib/program';

export default function ProgramScopeMatrixPage() {
  const rows = useMemo(() => requiredScopeRows(), []);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [projectId, setProjectId] = useState('all');
  const [open, setOpen] = useState<RequiredScopeRow | null>(null);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) => (!gapsOnly || !r.covered) && (projectId === 'all' || r.projectId === projectId)
      ),
    [rows, gapsOnly, projectId]
  );

  const covered = rows.filter((r) => r.covered).length;
  const gaps = rows.length - covered;

  /** Grouped for display: one block per package, because taxonomies are package-scoped. */
  const grouped = useMemo(() => {
    const byProject = new Map<string, RequiredScopeRow[]>();
    for (const row of visible) {
      const list = byProject.get(row.projectId) ?? [];
      list.push(row);
      byProject.set(row.projectId, list);
    }
    return [...byProject.entries()];
  }, [visible]);

  return (
    <>
      <SectionHead eyebrow="Program" title="Scope matrix">
        Specification-required scope, and whether any bidder covered it.
      </SectionHead>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <p className="small" style={{ marginTop: 0, color: 'var(--ink-2)' }}>
          Each package carries its own scope taxonomy, so a single shared row would mean different
          things in different columns and this page does not pretend otherwise. What <em>is</em>{' '}
          comparable across packages is whether the scope a specification <em>requires</em> got
          covered, because that is anchored to a spec section rather than to any package&rsquo;s
          vocabulary. That is what rolls up here.
        </p>

        <SegmentedBar
          ariaLabel="Required scope coverage across the program"
          height={16}
          segments={[
            {
              key: 'covered',
              label: 'Covered by at least one bidder',
              value: covered,
              color: 'var(--ok)',
              detail: `${covered} of ${rows.length} required items`,
            },
            {
              key: 'gap',
              label: 'Covered by nobody',
              value: gaps,
              color: 'var(--danger)',
              detail: 'No bidder priced these. A price comparison cannot surface them.',
            },
          ]}
        />
        <div className="row row-wrap small" style={{ gap: 16, marginTop: 10 }}>
          <span>
            <b className="num">{covered}</b> covered
          </span>
          <span style={{ color: gaps > 0 ? 'var(--danger)' : undefined }}>
            <b className="num">{gaps}</b> covered by nobody
          </span>
          <span className="muted">across {PROJECT_IDS.length} packages</span>
        </div>
      </div>

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 280px' }}>
          <span className="small muted">Package</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All packages</option>
            {PROJECT_IDS.map((id) => (
              <option key={id} value={id}>
                {PROJECTS[id].project.project_name}
              </option>
            ))}
          </select>
        </label>

        <label className="switch">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          <span>Uncovered only</span>
        </label>

        <span className="small muted" style={{ marginLeft: 'auto' }}>
          {visible.length} of {rows.length} shown
        </span>
      </div>

      {grouped.length === 0 && (
        <p className="muted">Nothing matches these filters.</p>
      )}

      {grouped.map(([id, packageRows]) => {
        const data = PROJECTS[id];
        return (
          <div key={id} className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
            <div className="card-pad" style={{ paddingBottom: 0 }}>
              <div className="row row-wrap">
                <b style={{ flex: 1 }}>{data.project.project_name}</b>
                <span className="small muted">{data.project.bid_package_description}</span>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Required scope</th>
                    <th>Spec section</th>
                    <th>Coverage</th>
                    <th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {packageRows.map((row) => (
                    <tr key={`${row.projectId}-${row.scopeKey}`}>
                      <td>
                        {row.title}
                        {row.critical && (
                          <span className="pill p-danger" style={{ marginLeft: 8 }}>
                            critical
                          </span>
                        )}
                      </td>
                      <td className="mono small muted">{row.specSection}</td>
                      <td>
                        {row.covered ? (
                          <span className="small">
                            <b className="num">{row.includedBy.length}</b> of{' '}
                            <span className="num">{row.bidderCount}</span> bidders included it
                          </span>
                        ) : (
                          <span className="pill p-danger">no bidder included it</span>
                        )}
                      </td>
                      <td className="td-open">
                        <button type="button" className="table-open" onClick={() => setOpen(row)}>
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        eyebrow={open ? `Specification ${open.specSection}` : ''}
        title={open?.title ?? ''}
        footer={
          open && (
            <Link href={`/p/${open.projectId}/compare/`} className="btn" data-variant="primary">
              Open the package scope matrix
            </Link>
          )
        }
      >
        {open && (
          <>
            <div className="small muted" style={{ marginBottom: 14 }}>
              {open.projectName} · {open.packageLabel}
            </div>

            {open.covered ? (
              <>
                <h3 style={{ marginTop: 0 }}>
                  Included by {open.includedBy.length} of {open.bidderCount} bidders
                </h3>
                <div className="stack" style={{ gap: 6 }}>
                  {open.includedBy.map((name) => (
                    <div key={name} className="row small">
                      <span className="pill p-included">Included</span>
                      <span style={{ flex: 1 }}>{name}</span>
                    </div>
                  ))}
                </div>
                <p className="small muted" style={{ marginTop: 14 }}>
                  Bidders who excluded or never addressed this item had it priced into their leveled
                  total, at the estimator-entered value.
                </p>
              </>
            ) : (
              <div className="card card-pad" style={{ borderLeft: '3px solid var(--danger)' }}>
                <b>No bidder covered this.</b>
                <p style={{ color: 'var(--ink-2)', marginBottom: 0 }}>
                  This is the finding a side-by-side price comparison structurally cannot produce.
                  When every bidder omits the same item, nothing in the spread looks unusual, yet
                  the whole package is underpriced against the specification.
                </p>
              </div>
            )}

            {open.critical && (
              <p className="small" style={{ color: 'var(--danger)', marginTop: 14 }}>
                Marked critical in the specification.
              </p>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
