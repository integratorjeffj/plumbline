'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionHead, SeverityPill } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { DonutChart, ColumnChart } from '@/components/Charts';
import { PROJECTS, PROJECT_IDS } from '@/lib/projects';
import { allFindings, severityTally, type ProgramFinding } from '@/lib/program';
import type { Severity } from '@/lib/types';

const SEVERITY_COLOR: Record<Severity, string> = {
  HIGH: 'var(--danger)',
  MEDIUM: 'var(--warn)',
  INFO: 'var(--ink-3)',
};

/** Plain-language gloss for each rule, so a code is never the only explanation. */
const RULE_NOTE: Record<string, string> = {
  arithmetic_discrepancy: 'The stated base bid disagrees with the sum of the vendor’s own line items.',
  stale_drawing_revision: 'Priced against a superseded drawing set.',
  drawing_revision_unstated: 'The proposal never says which drawing revision it priced.',
  required_scope_missing_all_bidders: 'Specification-required scope that no bidder covered. A price comparison cannot surface this, because nothing in the spread looks unusual.',
  pricing_outlier_low: 'Materially below the median submitted price.',
  large_leveling_delta: 'Rises sharply once excluded scope is priced, meaning the submitted number was materially incomplete.',
  unclear_scope_requires_clarification: 'Ambiguous scope. This becomes a clarification request, not a price assumption.',
  adjusted_over_budget: 'The leveled total exceeds the package budget.',
  superseded_revision: 'A later revision replaced this submission. The comparison uses the latest.',
  addenda_not_acknowledged: 'Priced an older drawing revision, so one or more issued addenda are not in the number.',
  addenda_acknowledgment_unstated: 'No stated revision, so there is no evidence any addendum was incorporated.',
  coverage_thin: 'Meets the minimum bidder count but falls short of the target.',
  coverage_below_minimum: 'Fewer responsive bidders than a competitively bid package requires.',
  invitation_no_response: 'Invited firms that never responded. The bids that never arrived do not appear in any comparison.',
};

export default function ProgramFindingsPage() {
  const findings = useMemo(() => allFindings(), []);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [projectId, setProjectId] = useState<string>('all');
  const [open, setOpen] = useState<ProgramFinding | null>(null);

  const tally = useMemo(() => severityTally(findings), [findings]);

  const visible = useMemo(
    () =>
      findings.filter(
        (f) =>
          (severity === null || f.severity === severity) &&
          (projectId === 'all' || f.projectId === projectId)
      ),
    [findings, severity, projectId]
  );

  const byPackage = useMemo(
    () =>
      PROJECT_IDS.map((id) => ({
        key: id,
        label: PROJECTS[id].project.project_name.split(' ')[0],
        value: findings.filter((f) => f.projectId === id).length,
        color: 'var(--accent)',
      })),
    [findings]
  );

  const donut = (['HIGH', 'MEDIUM', 'INFO'] as Severity[]).map((s) => ({
    key: s,
    label: s,
    value: tally[s],
    color: SEVERITY_COLOR[s],
  }));

  const columns: Column<ProgramFinding>[] = [
    {
      key: 'severity',
      header: 'Severity',
      sortValue: (f) => ({ HIGH: 0, MEDIUM: 1, INFO: 2 })[f.severity],
      render: (f) => <SeverityPill severity={f.severity} />,
    },
    {
      key: 'summary',
      header: 'Finding',
      sortValue: (f) => f.summary,
      render: (f) => (
        <>
          <div>{f.summary}</div>
          <div className="mono small muted">{f.code}</div>
        </>
      ),
    },
    {
      key: 'package',
      header: 'Package',
      secondary: true,
      sortValue: (f) => f.projectName,
      render: (f) => (
        <>
          <div>{f.projectName}</div>
          <div className="small muted">{f.packageLabel}</div>
        </>
      ),
    },
    {
      key: 'vendor',
      header: 'Bidder',
      secondary: true,
      sortValue: (f) => f.vendor_name ?? '',
      render: (f) =>
        f.vendor_name ? f.vendor_name : <span className="muted">package-wide</span>,
    },
  ];

  return (
    <>
      <SectionHead eyebrow="Program" title="Findings">
        Every anomaly the rules engine raised, across all bid packages. Severity orders within a
        package; package identity is carried on every row, so nothing is silently interleaved.
      </SectionHead>

      <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch', marginBottom: 20 }}>
        <div className="card card-pad" style={{ flex: '1 1 260px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>By severity</h3>
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <DonutChart
              segments={donut}
              ariaLabel="Findings by severity"
              centerLabel="findings"
              onSelect={(key) => setSeverity(key as Severity | null)}
              selected={severity}
            />
            <div className="legend" style={{ flexDirection: 'column', gap: 8 }}>
              {donut.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  className="legend-item"
                  data-dim={severity !== null && severity !== segment.key ? '' : undefined}
                  aria-pressed={severity === segment.key}
                  onClick={() => setSeverity(severity === segment.key ? null : (segment.key as Severity))}
                >
                  <span className="legend-swatch" style={{ background: segment.color }} />
                  <span style={{ flex: 1 }}>{segment.label}</span>
                  <span className="num">{segment.value}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Click a segment or a legend row to filter the table.
          </p>
        </div>

        <div className="card card-pad" style={{ flex: '1 1 300px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>By package</h3>
          <ColumnChart
            columns={byPackage}
            ariaLabel="Findings by package"
            onSelect={(key) => setProjectId(projectId === key ? 'all' : key)}
          />
        </div>
      </div>

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 280px' }}>
          <span className="small muted">Package</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All packages ({findings.length})</option>
            {PROJECT_IDS.map((id) => (
              <option key={id} value={id}>
                {PROJECTS[id].project.project_name} (
                {findings.filter((f) => f.projectId === id).length})
              </option>
            ))}
          </select>
        </label>

        <div className="row row-wrap" style={{ gap: 6, flex: 1 }}>
          <button
            type="button"
            className="btn"
            aria-label="Show findings of every severity"
            aria-pressed={severity === null}
            data-active={severity === null || undefined}
            onClick={() => setSeverity(null)}
          >
            All severities
          </button>
          {(['HIGH', 'MEDIUM', 'INFO'] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              // The donut legend also offers a "HIGH" control. Naming these by
              // what they do keeps the two distinguishable to a screen reader,
              // which was the reason a test could not tell them apart either.
              aria-label={`Show only ${s} severity findings`}
              aria-pressed={severity === s}
              data-active={severity === s || undefined}
              onClick={() => setSeverity(severity === s ? null : s)}
            >
              {s} <span className="tab-count num">{tally[s]}</span>
            </button>
          ))}
        </div>

        <span className="small muted">
          {visible.length} of {findings.length} shown
        </span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(f) => `${f.projectId}-${f.code}-${f.vendor_id ?? 'pkg'}-${f.summary.slice(0, 24)}`}
          caption="Every finding across all bid packages"
          initialSortKey="severity"
          onOpenRow={setOpen}
          emptyMessage="No findings match these filters."
        />
      </div>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        eyebrow={open ? `${open.severity} · ${open.code}` : ''}
        title={open?.vendor_name ?? open?.projectName ?? ''}
        footer={
          open && (
            <Link href={`/p/${open.projectId}/compare/`} className="btn" data-variant="primary">
              Open this package
            </Link>
          )
        }
      >
        {open && (
          <>
            <p style={{ marginTop: 0 }}>{open.summary}</p>

            {RULE_NOTE[open.code] && (
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div className="small muted" style={{ marginBottom: 4 }}>
                  What this rule checks
                </div>
                {RULE_NOTE[open.code]}
              </div>
            )}

            <h3>Where</h3>
            <div className="small" style={{ color: 'var(--ink-2)', marginBottom: 16 }}>
              {open.projectName}
              <br />
              {open.packageLabel}
            </div>

            {Object.keys(open.detail ?? {}).length > 0 && (
              <>
                <h3>Evidence</h3>
                <table>
                  <tbody>
                    {Object.entries(open.detail).map(([key, value]) => (
                      <tr key={key}>
                        <td className="small muted">{key.replace(/_/g, ' ')}</td>
                        <td className="num small" style={{ textAlign: 'right' }}>
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
