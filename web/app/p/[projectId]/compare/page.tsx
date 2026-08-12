'use client';

import { useStore } from '@/lib/store';
import { ScopePill, SectionHead, SeverityPill } from '@/components/Bits';
import { RankingTable } from '@/components/RankingTable';
import { money, percent, signedMoney } from '@/lib/format';

export default function ComparePage() {
  const { data, vendors, findings, isDirty, resetSettings } = useStore();

  const bySubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank);
  const maxAdjusted = Math.max(...vendors.map((v) => v.adjusted_total), data.project.budget);

  return (
    <>
      <SectionHead eyebrow="Step 04 · Leveling" title="What each bid actually costs">
        Solid blue is what the vendor submitted. Each amber segment is scope they excluded or never
        addressed, priced at the estimator-entered value. Change a weight on the Scope &amp;
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

      {/* ---------- leveling bars ---------- */}
      <div className="stack" style={{ gap: 14, marginBottom: 30 }}>
        {bySubmitted.map((v) => {
          const submittedPct = (v.submitted_total / maxAdjusted) * 100;
          const budgetPct = (data.project.budget / maxAdjusted) * 100;
          return (
            <div key={v.vendor_id} className="card card-pad">
              <div className="row row-wrap" style={{ marginBottom: 10 }}>
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
                style={{
                  position: 'relative',
                  display: 'flex',
                  height: 26,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'var(--surface-2)',
                }}
              >
                <div style={{ width: `${submittedPct}%`, background: 'var(--accent)' }} />
                {v.adjustments.map((a) => (
                  <div
                    key={a.scope_key}
                    title={`${a.label}: ${money(a.amount, 2)} (${a.status})`}
                    style={{
                      width: `${(a.amount / maxAdjusted) * 100}%`,
                      background: 'var(--warn)',
                      borderLeft: '1px solid var(--surface)',
                    }}
                  />
                ))}
                <div
                  title={`Package budget ${money(data.project.budget)}`}
                  style={{
                    position: 'absolute',
                    left: `${budgetPct}%`,
                    top: -3,
                    bottom: -3,
                    width: 2,
                    background: 'var(--danger)',
                  }}
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
        <div className="small muted row" style={{ gap: 16 }}>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: 'var(--accent)',
                borderRadius: 2,
                marginRight: 5,
              }}
            />
            submitted
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: 'var(--warn)',
                borderRadius: 2,
                marginRight: 5,
              }}
            />
            priced scope gap
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 10,
                background: 'var(--danger)',
                marginRight: 5,
              }}
            />
            budget {money(data.project.budget)}
          </span>
        </div>
      </div>

      {/* ---------- ranking ---------- */}
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Ranking</h2>
      <div style={{ marginBottom: 30 }}>
        <RankingTable vendors={vendors} />
      </div>

      {/* ---------- scope matrix ---------- */}
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Scope matrix</h2>
      <div className="card" style={{ marginBottom: 30, overflow: 'hidden' }}>
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

      {/* ---------- revisions ---------- */}
      {data.revisions.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Revisions</h2>
          <div className="stack" style={{ gap: 10, marginBottom: 30 }}>
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
                    .map((c) => `${c.label}: ${c.delta !== null ? signedMoney(c.delta) : `${c.previous} → ${c.current}`}`)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------- findings ---------- */}
      <h2 id="findings" style={{ fontSize: 20, marginBottom: 12 }}>
        Findings ({findings.length})
      </h2>
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
    </>
  );
}
