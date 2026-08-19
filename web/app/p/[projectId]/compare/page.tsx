'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { ScopePill, SectionHead, SeverityPill } from '@/components/Bits';
import { ChartAxis, Gridlines, scaleTicks } from '@/components/ChartScale';
import { DataTable, type Column } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { TabPanel, TabStrip, type TabDef } from '@/components/Tabs';
import { money, percent, signedMoney } from '@/lib/format';
import type { VendorComparison } from '@/lib/types';

type TabKey = 'leveling' | 'ranking' | 'scope' | 'findings' | 'revisions';

export default function ComparePage() {
  const { data, vendors, findings, isDirty, resetSettings } = useStore();
  const [tab, setTab] = useState<TabKey>('leveling');
  const [openVendor, setOpenVendor] = useState<VendorComparison | null>(null);

  const bySubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank);
  const maxAdjusted = Math.max(...vendors.map((v) => v.adjusted_total), data.project.budget);
  const ticks = scaleTicks(maxAdjusted);

  const tabs: TabDef<TabKey>[] = [
    { key: 'leveling', label: 'Leveling' },
    { key: 'ranking', label: 'Ranking' },
    { key: 'scope', label: 'Scope matrix', count: data.scope_items.length },
    { key: 'findings', label: 'Findings', count: findings.length },
  ];
  if (data.revisions.length > 0) {
    tabs.push({ key: 'revisions', label: 'Revisions', count: data.revisions.length });
  }

  const columns: Column<VendorComparison>[] = [
    {
      key: 'vendor',
      header: 'Bidder',
      sortValue: (v) => v.vendor_name,
      render: (v) => <b>{v.vendor_name}</b>,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      numeric: true,
      sortValue: (v) => v.submitted_total,
      render: (v) => money(v.submitted_total),
    },
    {
      key: 'adjusted',
      header: 'Leveled',
      numeric: true,
      sortValue: (v) => v.adjusted_total,
      render: (v) => <b>{money(v.adjusted_total)}</b>,
    },
    {
      key: 'delta',
      header: 'Added by leveling',
      numeric: true,
      secondary: true,
      sortValue: (v) => v.leveling_delta,
      render: (v) =>
        v.leveling_delta > 0 ? (
          <span style={{ color: 'var(--warn)' }}>
            {signedMoney(v.leveling_delta)} ({percent(v.leveling_delta_pct)})
          </span>
        ) : (
          <span className="muted">none</span>
        ),
    },
    {
      key: 'move',
      header: 'Move',
      numeric: true,
      sortValue: (v) => v.rank_movement,
      render: (v) =>
        v.rank_movement === 0 ? (
          <span className="muted">0</span>
        ) : (
          <span style={{ color: v.rank_movement > 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {v.rank_movement > 0 ? '+' : ''}
            {v.rank_movement}
          </span>
        ),
    },
  ];

  return (
    <>
      <SectionHead eyebrow="Step 04 · Leveling" title="What each bid actually costs">
        The solid segment is what the vendor submitted. Each amber segment is scope they excluded or
        never addressed, priced at the estimator-entered value. Change a weight on the Scope &amp;
        weighting page and every number here moves.
      </SectionHead>

      {isDirty && (
        <div className="row card card-pad" style={{ marginBottom: 18, borderLeft: '3px solid var(--warn)' }}>
          <span className="pill p-warn">modified</span>
          <span className="small" style={{ color: 'var(--ink-2)', flex: 1 }}>
            These figures reflect your weighting changes, not the pipeline defaults.
          </span>
          <button className="btn" onClick={resetSettings}>
            Reset to pipeline defaults
          </button>
        </div>
      )}

      <TabStrip tabs={tabs} active={tab} onChange={setTab} label="Compare sections" />

      {tab === 'leveling' && (
        <TabPanel tabKey="leveling">
          {/* One card, not one per vendor: the bars only mean anything against
              each other, and they can only share an axis if they share a
              container the axis can span. */}
          <div className="card card-pad">
            <div className="chart-rows">
              {bySubmitted.map((v) => {
                const submittedPct = (v.submitted_total / maxAdjusted) * 100;
                const budgetPct = (data.project.budget / maxAdjusted) * 100;
                const overBudget = v.adjusted_total > data.project.budget;
                return (
                  <div key={v.vendor_id} className="chart-row">
                    <div className="row row-wrap" style={{ marginBottom: 8 }}>
                      <b style={{ flex: 1 }}>{v.vendor_name}</b>
                      <span className="pill p-muted">
                        {v.submitted_rank} → {v.adjusted_rank}
                      </span>
                      <span className="small num">
                        {money(v.submitted_total)} →{' '}
                        <b style={{ color: v.leveling_delta > 0 ? 'var(--warn)' : 'inherit' }}>
                          {money(v.adjusted_total)}
                        </b>{' '}
                        <span className="muted">({percent(v.leveling_delta_pct)})</span>
                      </span>
                    </div>

                    <div
                      className="chart-track"
                      role="img"
                      aria-label={`${v.vendor_name} submitted ${money(v.submitted_total)}, ${money(v.adjusted_total)} once leveled, against a budget of ${money(data.project.budget)}`}
                    >
                      <Gridlines ticks={ticks} />
                      <span
                        className="chart-fill"
                        data-part="submitted"
                        style={{ width: `${submittedPct}%` }}
                      />
                      {v.adjustments.reduce<{ offset: number; nodes: React.ReactNode[] }>(
                        (acc, a) => {
                          const width = (a.amount / maxAdjusted) * 100;
                          acc.nodes.push(
                            <span
                              key={a.scope_key}
                              className="chart-fill"
                              data-part="leveling"
                              title={`${a.label}: ${money(a.amount, 2)} (${a.status})`}
                              style={{ left: `${acc.offset}%`, width: `${width}%` }}
                            />
                          );
                          acc.offset += width;
                          return acc;
                        },
                        { offset: submittedPct, nodes: [] }
                      ).nodes}
                      <span
                        className="chart-budget"
                        data-over={overBudget}
                        style={{ left: `${budgetPct}%` }}
                      />
                    </div>

                    {v.adjustments.length > 0 ? (
                      <div className="row row-wrap small muted" style={{ marginTop: 8, gap: 14 }}>
                        {v.adjustments.map((a) => (
                          <span key={a.scope_key}>
                            <span className="num" style={{ color: 'var(--warn)' }}>
                              {signedMoney(a.amount)}
                            </span>{' '}
                            {a.label} <span style={{ opacity: 0.7 }}>({a.status})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="small muted" style={{ marginTop: 8 }}>
                        No scope gaps priced against this bid.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ChartAxis ticks={ticks} maxScale={maxAdjusted} budget={data.project.budget} />

            <div className="chart-legend">
              <span>
                <span className="swatch" data-part="submitted" /> the price this vendor actually
                submitted
              </span>
              <span>
                <span className="swatch" data-part="leveling" /> scope they excluded or never
                addressed, priced at the estimator-entered value
              </span>
              <span>
                <span className="swatch" data-part="budget" /> the package budget, red where this
                bid crosses it
              </span>
            </div>
          </div>
        </TabPanel>
      )}

      {tab === 'ranking' && (
        <TabPanel tabKey="ranking">
          <div className="card" style={{ overflow: 'hidden' }}>
            <DataTable
              rows={vendors}
              columns={columns}
              rowKey={(v) => v.vendor_id}
              caption="Bidders by submitted and leveled price"
              initialSortKey="adjusted"
              onOpenRow={setOpenVendor}
              rowAttrs={(v) => ({ 'data-recommended': v.adjusted_rank === 1 ? '' : undefined })}
            />
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Sort any column. Open a bidder to see exactly which scope gaps were priced into their
            leveled total, without losing your place here.
          </p>
        </TabPanel>
      )}

      {tab === 'scope' && (
        <TabPanel tabKey="scope">
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Scope item</th>
                    {bySubmitted.map((v) => (
                      <th key={v.vendor_id}>{v.vendor_name.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.scope_items.map((item) => (
                    <tr key={item.key}>
                      <td>
                        {item.label}
                        {!item.in_package_scope && (
                          <span className="small muted" title="Carried by another bid package">
                            {' '}
                            ·  other package
                          </span>
                        )}
                      </td>
                      {bySubmitted.map((v) => (
                        <td key={v.vendor_id}>
                          <ScopePill status={item.statuses[v.vendor_id] ?? 'NotFound'} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabPanel>
      )}

      {tab === 'findings' && (
        <TabPanel tabKey="findings">
          <div className="stack" style={{ gap: 8 }}>
            {findings.map((f, i) => (
              <div key={`${f.code}-${i}`} className="card card-pad">
                <div className="row row-wrap" style={{ alignItems: 'flex-start' }}>
                  <SeverityPill severity={f.severity} />
                  <span className="mono small muted">{f.code}</span>
                </div>
                <div style={{ marginTop: 6, color: 'var(--ink-2)' }}>{f.summary}</div>
              </div>
            ))}
          </div>
        </TabPanel>
      )}

      {tab === 'revisions' && (
        <TabPanel tabKey="revisions">
          <div className="stack" style={{ gap: 10 }}>
            {data.revisions.map((r) => (
              <div key={r.vendor_id} className="card card-pad">
                <div className="row row-wrap">
                  <b style={{ flex: 1 }}>{r.vendor_name}</b>
                  <span className="small num">
                    {r.previous_label} → {r.current_label} · {money(r.previous_total)} →{' '}
                    {money(r.current_total)}{' '}
                    <span style={{ color: r.total_delta < 0 ? 'var(--ok)' : 'var(--warn)' }}>
                      ({signedMoney(r.total_delta)})
                    </span>
                  </span>
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {r.changes
                    .filter((c) => c.label !== 'Base bid')
                    .map((c) =>
                      `${c.label}: ${c.delta !== null ? signedMoney(c.delta) : `${c.previous} → ${c.current}`}`
                    )
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </TabPanel>
      )}

      <Drawer
        open={openVendor !== null}
        onClose={() => setOpenVendor(null)}
        eyebrow={`Leveled rank ${openVendor?.adjusted_rank} of ${vendors.length}`}
        title={openVendor?.vendor_name ?? ''}
      >
        {openVendor && (
          <>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="row row-wrap small">
                <span className="muted" style={{ flex: 1 }}>
                  Submitted
                </span>
                <span className="num">{money(openVendor.submitted_total)}</span>
              </div>
              <div className="row row-wrap small" style={{ marginTop: 6 }}>
                <span className="muted" style={{ flex: 1 }}>
                  Priced scope gaps
                </span>
                <span className="num" style={{ color: 'var(--warn)' }}>
                  {signedMoney(openVendor.leveling_delta)}
                </span>
              </div>
              <div
                className="row row-wrap"
                style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}
              >
                <b style={{ flex: 1 }}>Leveled total</b>
                <b className="num">{money(openVendor.adjusted_total)}</b>
              </div>
            </div>

            <h3 style={{ marginTop: 0 }}>
              {openVendor.adjustments.length} scope gap
              {openVendor.adjustments.length === 1 ? '' : 's'} priced
            </h3>
            {openVendor.adjustments.length === 0 ? (
              <p className="muted">
                This bid covered every in-package scope item, so nothing was added to it.
              </p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {openVendor.adjustments.map((a) => (
                  <div key={a.scope_key} className="card card-pad">
                    <div className="row row-wrap">
                      <b style={{ flex: 1 }}>{a.label}</b>
                      <ScopePill status={a.status as never} />
                      <span className="num" style={{ color: 'var(--warn)' }}>
                        {signedMoney(a.amount)}
                      </span>
                    </div>
                    <div className="small muted" style={{ marginTop: 6 }}>
                      {a.rationale}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openVendor.unclear_scope_keys.length > 0 && (
              <>
                <h3>Left ambiguous</h3>
                <p className="small muted">
                  {openVendor.unclear_scope_keys.length} item(s) were mentioned but not resolved.
                  These become clarification requests, not price assumptions.
                </p>
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
