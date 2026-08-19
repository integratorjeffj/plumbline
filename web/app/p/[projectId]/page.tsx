'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CoveragePill, Kpi, SectionHead, SeverityPill } from '@/components/Bits';
import { money, percent } from '@/lib/format';

const PIPELINE_STAGES = [
  { n: '01', name: 'Intake', kind: 'Deterministic', body: 'Bid arrives with attachments. Hashed SHA-256 before anything else touches it.' },
  { n: '02', name: 'Extract', kind: 'Deterministic', body: 'Page-aware text from PDF, sheet-aware from Excel, plus the email body when pricing lives there.' },
  { n: '03', name: 'Interpret', kind: 'AI', body: 'Claude maps prose onto the fixed scope taxonomy and pulls figures, schema-constrained.' },
  { n: '04', name: 'Level', kind: 'Deterministic', body: 'Scope gaps priced with estimator-entered values. Rankings and rules computed in plain code.' },
  { n: '05', name: 'Decide', kind: 'Human', body: 'A reviewer approves or rejects each extraction. The system never awards a bid.' },
];

/** Coarse document-format bucket, used only to count how many distinct formats a package saw. */
function formatCategory(format: string): string {
  const lower = format.toLowerCase();
  if (lower.includes('excel')) return 'Excel';
  if (lower.includes('email')) return 'email';
  return 'PDF';
}

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, vendors, findings, reviews, parity } = useStore();

  const lowestSubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank)[0];
  const lowestAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank)[0];
  const inverted = lowestSubmitted.vendor_id !== lowestAdjusted.vendor_id;

  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const pendingCount = data.submissions.filter(
    (s) => (reviews[s.bid_id]?.status ?? 'pending') === 'pending'
  ).length;
  const formatCount = new Set(data.submissions.map((s) => formatCategory(s.format))).size;

  // Requirement coverage: the fraction of specification-required scope items
  // that at least one bidder actually included, across the package's whole
  // taxonomy -- not tied to any single item, so this reads correctly
  // regardless of which package (electrical, mechanical, ...) is open.
  const coverage = data.coverage ?? null;
  const unacknowledged = coverage?.acknowledgments.filter((a) => a.missing_addenda.length) ?? [];

  const requiredKeys = data.required_scope.map((r) => r.scope_key);
  const coveredKeys = requiredKeys.filter((key) => {
    const item = data.scope_items.find((si) => si.key === key);
    return item ? Object.values(item.statuses).some((s) => s === 'Included') : false;
  });

  return (
    <>
      <SectionHead eyebrow="Bid package overview" title={`${data.project.project_name}`}>
        {data.project.bid_package_number} · {data.project.bid_package_description} ·{' '}
        {data.project.customer} · Drawings at {data.project.drawing_revision} · Budget{' '}
        {money(data.project.budget)}
      </SectionHead>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <Kpi
          value={String(data.summary.documents_processed)}
          label={`Documents ingested across ${formatCount} format${formatCount === 1 ? '' : 's'}`}
        />
        <Kpi
          value={money(lowestSubmitted.leveling_delta > 0 ? lowestSubmitted.leveling_delta : 0)}
          label="Hidden scope gap in the low bid"
          flag
        />
        <Kpi value={String(highCount)} label="High-severity findings raised" flag={highCount > 0} />
        <Kpi
          value={`${coveredKeys.length} of ${requiredKeys.length}`}
          label="Required scope items covered by at least one bidder"
          flag={coveredKeys.length < requiredKeys.length}
        />
      </div>

      {inverted && (
        <div
          className="card card-pad"
          style={{ marginBottom: 26, borderLeft: '3px solid var(--danger)' }}
        >
          <h2 style={{ marginBottom: 8 }}>The cheapest bid is not the best value.</h2>
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
            <Link href={`/p/${projectId}/compare/`} className="btn" data-variant="primary">
              See the leveled comparison
            </Link>
            <Link href={`/p/${projectId}/review/`} className="btn">
              Review the extractions ({pendingCount} pending)
            </Link>
          </div>
        </div>
      )}


      {coverage && (
        <div className="card card-pad" style={{ marginBottom: 26 }}>
          <div className="row row-wrap" style={{ marginBottom: 10 }}>
            <h2 style={{ flex: 1, margin: 0 }}>Bid coverage</h2>
            <CoveragePill health={coverage.health} />
          </div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 14, maxWidth: '76ch' }}>
            Measured from the invitation out, not from the bids in. A handful of proposals side by
            side can look like a competitive package when the reason the spread is narrow is that
            the firms who would have priced it lower never responded.
          </p>

          <div className="coverage-bar" role="img"
               aria-label={`${coverage.responded_count} responded, ${coverage.declined_count} declined, ${coverage.no_response_count} no response`}>
            <span className="coverage-seg" data-kind="responded"
                  style={{ flex: coverage.responded_count || 0.001 }} />
            <span className="coverage-seg" data-kind="declined"
                  style={{ flex: coverage.declined_count || 0.001 }} />
            <span className="coverage-seg" data-kind="silent"
                  style={{ flex: coverage.no_response_count || 0.001 }} />
          </div>

          <div className="row row-wrap small" style={{ gap: 16, marginTop: 10 }}>
            <span><b className="num">{coverage.responded_count}</b> responded</span>
            <span className="muted"><b className="num">{coverage.declined_count}</b> declined</span>
            <span className="muted"><b className="num">{coverage.no_response_count}</b> no response</span>
            <span className="muted">
              {coverage.response_rate_pct.toFixed(0)}% of {coverage.invited_count} invited ·
              {' '}minimum {coverage.minimum_bidders}, target {coverage.target_bidders}
            </span>
          </div>

          {unacknowledged.length > 0 && (
            <div className="stack" style={{ gap: 6, marginTop: 16 }}>
              {unacknowledged.map((ack) => (
                <div key={ack.vendor_id} className="row row-wrap small"
                     style={{ borderLeft: '3px solid var(--danger)', paddingLeft: 10 }}>
                  <b style={{ flex: 1 }}>{ack.vendor_name}</b>
                  <span style={{ color: 'var(--ink-2)' }}>
                    priced {ack.drawing_revision_referenced ?? 'no stated revision'} · missing
                    {' '}Addend{ack.missing_addenda.length > 1 ? 'a' : 'um'}{' '}
                    {ack.missing_addenda.join(', ')} of {coverage.current_addendum}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>The pipeline</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14, maxWidth: '76ch' }}>
        The division of labor is deliberate. The model reads prose and decides what a sentence
        means. Everything that produces a number is ordinary code, which is what makes the output
        reproducible and auditable.
      </p>
      <div className="grid grid-stages" style={{ marginBottom: 26 }}>
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.n} className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {stage.n}
            </div>
            <h3 style={{ marginBottom: 6 }}>{stage.name}</h3>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              {stage.body}
            </p>
            <span
              className={`pill ${
                stage.kind === 'Deterministic' ? 'p-muted' : 'p-tag'
              }`}
            >
              {stage.kind}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 style={{ marginBottom: 10 }}>Open findings</h3>
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
          <Link
            href={`/p/${projectId}/compare/#findings`}
            className="btn"
            style={{ marginTop: 14, display: 'inline-block' }}
          >
            All {findings.length} findings
          </Link>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginBottom: 10 }}>Engine parity</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            The console re-levels bids in the browser so weighting changes are instant. That is a
            second implementation of logic the pipeline export already owns, so it is checked
            against that export on every load rather than trusted.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <span className={`pill ${parity.ok ? 'p-ok' : 'p-danger'}`}>
              {parity.ok ? 'matches pipeline' : 'drift detected'}
            </span>
            <span className="small muted">{parity.checked} vendor totals verified</span>
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
