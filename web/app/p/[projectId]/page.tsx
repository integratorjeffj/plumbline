'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CoveragePill, GatePill, Kpi, SectionHead, SeverityPill } from '@/components/Bits';
import { ColumnChart, DonutChart, SegmentedBar } from '@/components/Charts';
import { Drawer } from '@/components/Drawer';
import { money, percent } from '@/lib/format';
import type { VendorComparison } from '@/lib/types';

/** Coarse document-format bucket, only used to count distinct formats. */
function formatCategory(format: string): string {
  const lower = format.toLowerCase();
  if (lower.includes('excel')) return 'Excel';
  if (lower.includes('email')) return 'email';
  return 'PDF';
}

type BidMode = 'leveled' | 'submitted';

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, vendors, findings, reviews, parity, award } = useStore();
  const [bidMode, setBidMode] = useState<BidMode>('leveled');
  const [openVendor, setOpenVendor] = useState<VendorComparison | null>(null);

  const lowestSubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank)[0];
  const lowestAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank)[0];
  const inverted = lowestSubmitted.vendor_id !== lowestAdjusted.vendor_id;

  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const pendingCount = data.submissions.filter(
    (s) => (reviews[s.bid_id]?.status ?? 'pending') === 'pending'
  ).length;
  const formatCount = new Set(data.submissions.map((s) => formatCategory(s.format))).size;

  const coverage = data.coverage ?? null;
  const unacknowledged = coverage?.acknowledgments.filter((a) => a.missing_addenda.length) ?? [];

  const requiredKeys = data.required_scope.map((r) => r.scope_key);
  const coveredKeys = requiredKeys.filter((key) => {
    const item = data.scope_items.find((si) => si.key === key);
    return item ? Object.values(item.statuses).some((s) => s === 'Included') : false;
  });

  /** Bidders as columns, coloured by whether the leveled total clears the budget. */
  const bidColumns = useMemo(
    () =>
      [...vendors]
        .sort((a, b) =>
          bidMode === 'leveled'
            ? a.adjusted_total - b.adjusted_total
            : a.submitted_total - b.submitted_total
        )
        .map((v) => {
          const value = bidMode === 'leveled' ? v.adjusted_total : v.submitted_total;
          const gated = award?.scores.find((s) => s.vendor_id === v.vendor_id)?.eligible === false;
          return {
            key: v.vendor_id,
            label: v.vendor_name.split(' ').slice(0, 2).join(' '),
            value,
            color: gated
              ? 'var(--ink-3)'
              : value > data.project.budget
                ? 'var(--warn)'
                : 'var(--ok)',
          };
        }),
    [vendors, bidMode, data.project.budget, award]
  );

  const scopeDonut = [
    {
      key: 'covered',
      label: 'Covered',
      value: coveredKeys.length,
      color: 'var(--ok)',
    },
    {
      key: 'gap',
      label: 'Covered by nobody',
      value: requiredKeys.length - coveredKeys.length,
      color: 'var(--danger)',
    },
  ];

  return (
    <>
      <SectionHead eyebrow="Bid package overview" title={data.project.project_name}>
        {data.project.bid_package_number} · {data.project.bid_package_description} ·{' '}
        {data.project.customer} · Drawings at {data.project.drawing_revision} · Budget{' '}
        {money(data.project.budget)}
      </SectionHead>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
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
        <div className="card card-pad" style={{ marginBottom: 22, borderLeft: '3px solid var(--danger)' }}>
          <h2 style={{ marginBottom: 8 }}>The cheapest bid is not the best value.</h2>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>
            <b>{lowestSubmitted.vendor_name}</b> submitted the lowest price at{' '}
            <span className="num">{money(lowestSubmitted.submitted_total)}</span>, but once excluded
            scope is priced it rises to{' '}
            <span className="num">{money(lowestSubmitted.adjusted_total)}</span> (
            {percent(lowestSubmitted.leveling_delta_pct)}), landing {lowestSubmitted.adjusted_rank}{' '}
            of {vendors.length}. Best value once leveled is <b>{lowestAdjusted.vendor_name}</b> at{' '}
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

      {/* ---------- the bids, as a chart ---------- */}
      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="row row-wrap" style={{ marginBottom: 4 }}>
          <h2 style={{ flex: 1, margin: 0 }}>The bids</h2>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn"
              data-active={bidMode === 'leveled' || undefined}
              onClick={() => setBidMode('leveled')}
            >
              Leveled
            </button>
            <button
              type="button"
              className="btn"
              data-active={bidMode === 'submitted' || undefined}
              onClick={() => setBidMode('submitted')}
            >
              As submitted
            </button>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 0, marginBottom: 14 }}>
          Green clears the {money(data.project.budget)} budget, amber exceeds it, grey is a bidder
          prequalification gated. Toggle to submitted prices and watch the order change. Click a
          column for the breakdown.
        </p>

        <ColumnChart
          columns={bidColumns}
          height={170}
          ariaLabel={`Bidders by ${bidMode} price`}
          formatValue={(v) => money(v)}
          onSelect={(key) => setOpenVendor(vendors.find((v) => v.vendor_id === key) ?? null)}
        />
      </div>

      <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch', marginBottom: 22 }}>
        {/* ---------- required scope ---------- */}
        <div className="card card-pad" style={{ flex: '1 1 260px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Required scope</h3>
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <DonutChart
              segments={scopeDonut}
              size={112}
              thickness={14}
              ariaLabel="Specification-required scope coverage"
              centerLabel="required"
            />
            <div className="legend" style={{ flexDirection: 'column', gap: 8 }}>
              {scopeDonut.map((segment) => (
                <span key={segment.key} className="legend-item" style={{ cursor: 'default' }}>
                  <span className="legend-swatch" style={{ background: segment.color }} />
                  <span style={{ flex: 1 }}>{segment.label}</span>
                  <span className="num">{segment.value}</span>
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/scope-matrix/"
            className="btn"
            style={{ marginTop: 14, display: 'inline-block' }}
          >
            Open the scope matrix
          </Link>
        </div>

        {/* ---------- coverage ---------- */}
        {coverage && (
          <div className="card card-pad" style={{ flex: '2 1 380px' }}>
            <div className="row row-wrap" style={{ marginBottom: 8 }}>
              <h3 style={{ flex: 1, margin: 0 }}>Bid coverage</h3>
              <CoveragePill health={coverage.health} />
            </div>
            <p className="small muted" style={{ marginTop: 0, marginBottom: 14 }}>
              Measured from the invitation out. A handful of proposals side by side can look like a
              competitive package when the reason the spread is narrow is that the firms who would
              have priced it lower never responded.
            </p>

            <SegmentedBar
              height={16}
              ariaLabel="Invitation outcomes"
              segments={[
                {
                  key: 'responded',
                  label: 'Responded',
                  value: coverage.responded_count,
                  color: 'var(--ok)',
                  detail: 'These are the bids being compared.',
                },
                {
                  key: 'declined',
                  label: 'Declined',
                  value: coverage.declined_count,
                  color: 'var(--ink-3)',
                  detail: 'Declined with a stated reason.',
                },
                {
                  key: 'silent',
                  label: 'No response',
                  value: coverage.no_response_count,
                  color: 'var(--line-2)',
                  detail: 'Invited, followed up, never answered.',
                },
              ]}
            />

            <div className="row row-wrap small" style={{ gap: 16, marginTop: 12 }}>
              <span>
                <b className="num">{coverage.responded_count}</b> responded
              </span>
              <span className="muted">
                <b className="num">{coverage.declined_count}</b> declined
              </span>
              <span className="muted">
                <b className="num">{coverage.no_response_count}</b> no response
              </span>
              <span className="muted">
                {coverage.response_rate_pct.toFixed(0)}% of {coverage.invited_count} invited ·
                minimum {coverage.minimum_bidders}, target {coverage.target_bidders}
              </span>
            </div>

            {unacknowledged.length > 0 && (
              <div className="stack" style={{ gap: 6, marginTop: 16 }}>
                {unacknowledged.map((ack) => (
                  <div
                    key={ack.vendor_id}
                    className="row row-wrap small"
                    style={{ borderLeft: '3px solid var(--danger)', paddingLeft: 10 }}
                  >
                    <b style={{ flex: 1 }}>{ack.vendor_name}</b>
                    <span style={{ color: 'var(--ink-2)' }}>
                      priced {ack.drawing_revision_referenced ?? 'no stated revision'} · missing
                      Addend{ack.missing_addenda.length > 1 ? 'a' : 'um'}{' '}
                      {ack.missing_addenda.join(', ')} of {coverage.current_addendum}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            href={`/p/${projectId}/compare/`}
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

      <Drawer
        open={openVendor !== null}
        onClose={() => setOpenVendor(null)}
        eyebrow={openVendor ? `Leveled rank ${openVendor.adjusted_rank} of ${vendors.length}` : ''}
        title={openVendor?.vendor_name ?? ''}
        footer={
          openVendor && (
            <Link href={`/p/${projectId}/compare/`} className="btn" data-variant="primary">
              Open the full comparison
            </Link>
          )
        }
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
                  {openVendor.leveling_delta > 0 ? money(openVendor.leveling_delta) : 'none'}
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

            {award && (
              <>
                {(() => {
                  const score = award.scores.find((s) => s.vendor_id === openVendor.vendor_id);
                  if (!score) return null;
                  return (
                    <div className="card card-pad" style={{ marginBottom: 16 }}>
                      <div className="row row-wrap">
                        <b style={{ flex: 1 }}>Award score</b>
                        {score.eligible ? (
                          <GatePill status="pass" />
                        ) : (
                          <GatePill status="fail" />
                        )}
                        <span className="num">{score.total_score.toFixed(1)}</span>
                      </div>
                      {!score.eligible && (
                        <div className="small" style={{ color: 'var(--danger)', marginTop: 6 }}>
                          {score.disqualifying_reason}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

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
                  <div key={a.scope_key} className="row row-wrap small">
                    <span style={{ flex: 1 }}>{a.label}</span>
                    <span className="num" style={{ color: 'var(--warn)' }}>
                      {money(a.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
