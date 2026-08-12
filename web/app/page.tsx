'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Kpi, SectionHead, SeverityPill } from '@/components/Bits';
import { money, percent } from '@/lib/format';

const PIPELINE_STAGES = [
  { n: '01', name: 'Intake', kind: 'Deterministic', body: 'Bid arrives with attachments. Hashed SHA-256 before anything else touches it.' },
  { n: '02', name: 'Extract', kind: 'Deterministic', body: 'Page-aware text from PDF, sheet-aware from Excel, plus the email body when pricing lives there.' },
  { n: '03', name: 'Interpret', kind: 'AI', body: 'Claude maps prose onto the fixed scope taxonomy and pulls figures, schema-constrained.' },
  { n: '04', name: 'Level', kind: 'Deterministic', body: 'Scope gaps priced with estimator-entered values. Rankings and rules computed in plain code.' },
  { n: '05', name: 'Decide', kind: 'Human', body: 'A reviewer approves or rejects each extraction. The system never awards a bid.' },
];

export default function OverviewPage() {
  const { data, vendors, findings, reviews, parity } = useStore();

  const lowestSubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank)[0];
  const lowestAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank)[0];
  const inverted = lowestSubmitted.vendor_id !== lowestAdjusted.vendor_id;

  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const pendingCount = data.submissions.filter(
    (s) => (reviews[s.bid_id]?.status ?? 'pending') === 'pending'
  ).length;

  const arcFlash = data.scope_items.find((i) => i.key === 'arc_flash_study');
  const arcCovered = arcFlash
    ? Object.values(arcFlash.statuses).filter((s) => s === 'Included').length
    : 0;

  return (
    <>
      <SectionHead eyebrow="Bid package overview" title={`${data.project.project_name}`}>
        {data.project.bid_package_number} · {data.project.bid_package_description} ·{' '}
        {data.project.customer} · Drawings at {data.project.drawing_revision} · Budget{' '}
        {money(data.project.budget)}
      </SectionHead>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <Kpi value={String(data.summary.documents_processed)} label="Documents ingested across 4 formats" />
        <Kpi
          value={money(lowestSubmitted.leveling_delta > 0 ? lowestSubmitted.leveling_delta : 0)}
          label="Hidden scope gap in the low bid"
          flag
        />
        <Kpi value={String(highCount)} label="High-severity findings raised" flag={highCount > 0} />
        <Kpi
          value={`${arcCovered} of ${vendors.length}`}
          label="Bidders covering required arc-flash study"
          flag={arcCovered === 0}
        />
      </div>

      {inverted && (
        <div
          className="card card-pad"
          style={{ marginBottom: 26, borderLeft: '3px solid var(--danger)' }}
        >
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>The cheapest bid is not the best value.</h2>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>
            <b>{lowestSubmitted.vendor_name}</b> submitted the lowest price at{' '}
            <span className="num">{money(lowestSubmitted.submitted_total)}</span>, but once excluded
            scope is priced it rises to{' '}
            <span className="num">{money(lowestSubmitted.adjusted_total)}</span> (
            {percent(lowestSubmitted.leveling_delta_pct)}), landing{' '}
            {lowestSubmitted.adjusted_rank} of {vendors.length}. Best value once leveled is{' '}
            <b>{lowestAdjusted.vendor_name}</b> at{' '}
            <span className="num">{money(lowestAdjusted.adjusted_total)}</span>.
          </p>
          <div className="row row-wrap" style={{ marginTop: 14 }}>
            <Link href="/compare/" className="btn" data-variant="primary">
              See the leveled comparison
            </Link>
            <Link href="/review/" className="btn">
              Review the extractions ({pendingCount} pending)
            </Link>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>The pipeline</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14, maxWidth: '76ch' }}>
        The division of labor is deliberate. The model reads prose and decides what a sentence
        means. Everything that produces a number is ordinary code, which is what makes the output
        reproducible and auditable.
      </p>
      <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))', marginBottom: 26 }}>
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.n} className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {stage.n}
            </div>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>{stage.name}</h3>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              {stage.body}
            </p>
            <span
              className={`pill ${
                stage.kind === 'AI' ? 'p-accent' : stage.kind === 'Human' ? 'p-warn' : 'p-muted'
              }`}
            >
              {stage.kind}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Open findings</h3>
          <div className="stack" style={{ gap: 10 }}>
            {findings.slice(0, 5).map((f, i) => (
              <div key={`${f.code}-${i}`} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <SeverityPill severity={f.severity} />
                <span className="small" style={{ color: 'var(--ink-2)' }}>
                  {f.summary}
                </span>
              </div>
            ))}
          </div>
          <Link href="/compare/#findings" className="btn" style={{ marginTop: 14, display: 'inline-block' }}>
            All {findings.length} findings
          </Link>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Engine parity</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            The console re-levels bids in the browser so weighting changes are instant. That is a
            second implementation of logic the Python already owns, so it is checked against the
            pipeline export on every load rather than trusted.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <span className={`pill ${parity.ok ? 'p-ok' : 'p-danger'}`}>
              {parity.ok ? 'matches pipeline' : 'drift detected'}
            </span>
            <span className="small muted">
              {parity.checked} vendor totals verified against{' '}
              <span className="mono">scripts/export_demo_data.py</span>
            </span>
          </div>
          {!parity.ok && (
            <div className="note" style={{ marginTop: 12, borderLeftColor: 'var(--danger)' }}>
              {parity.mismatches.map((m) => (
                <div key={m.vendor} className="small">
                  {m.vendor}: expected {money(m.expected, 2)}, got {money(m.actual, 2)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
