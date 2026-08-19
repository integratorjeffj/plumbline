'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { EmptyState } from '@/components/EmptyState';
import { GatePill, ScoreBar, SectionHead } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { TabPanel, TabStrip, type TabDef } from '@/components/Tabs';
import { FACTOR_LABELS, FACTOR_ORDER, FACTOR_SHORT } from '@/lib/award';
import { money } from '@/lib/format';
import type { AwardFactor, VendorScore } from '@/lib/types';

type TabKey = 'recommendation' | 'scoring' | 'weighting';

/** Named presets, so the effect of a weighting change is one click away. */
const PRESETS: { label: string; note: string; weights: Record<AwardFactor, number> }[] = [
  {
    label: 'Balanced',
    note: 'The conventional 40/30/20/10 split',
    weights: { cost: 40, experience: 30, safety: 20, schedule: 10 },
  },
  {
    label: 'Track record first',
    note: 'Weight past performance over price',
    weights: { cost: 10, experience: 60, safety: 20, schedule: 10 },
  },
  {
    label: 'Price only',
    note: 'What an unwritten evaluation defaults to',
    weights: { cost: 100, experience: 0, safety: 0, schedule: 0 },
  },
];

export default function AwardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    award,
    awardParity,
    weights,
    weightsAreDefault,
    setWeight,
    resetWeights,
    awardedVendorId,
    setAwardedVendor,
  } = useStore();

  const [tab, setTab] = useState<TabKey>('recommendation');
  const [openScore, setOpenScore] = useState<VendorScore | null>(null);

  if (!award) {
    return (
      <>
        <SectionHead eyebrow="Step 05 · Decide" title="Award recommendation">
          A weighted decision model over the bidders who clear prequalification.
        </SectionHead>
        <EmptyState
          icon="scale"
          title="This package cannot produce an award recommendation yet"
          body="The model weighs leveled cost against experience, safety, and schedule, and three of those four come from prequalification records this package does not carry. Scoring price alone and calling it a recommendation would reproduce exactly the failure the model exists to prevent. The Falcon Medical electrical package carries the full record set."
          actionLabel="Open a package with an award model"
          actionHref="/p/falcon-medical/award/"
        />
      </>
    );
  }

  const winner = award.scores.find((s) => s.vendor_id === award.recommended_vendor_id);
  const awarded = award.scores.find((s) => s.vendor_id === awardedVendorId);
  const excludedCount = award.scores.filter((s) => !s.eligible).length;
  const weightTotal = FACTOR_ORDER.reduce((sum, f) => sum + weights[f], 0);
  const activePreset = PRESETS.find((p) => FACTOR_ORDER.every((f) => p.weights[f] === weights[f]));

  const tabs: TabDef<TabKey>[] = [
    { key: 'recommendation', label: 'Recommendation' },
    { key: 'scoring', label: 'Scoring', count: award.scores.length },
    { key: 'weighting', label: 'Weighting' },
  ];

  const columns: Column<VendorScore>[] = [
    {
      key: 'rank',
      header: '#',
      sortValue: (s) => s.rank ?? 99,
      render: (s) => (s.rank ? <span className="num">{s.rank}</span> : <GatePill status="fail" />),
    },
    {
      key: 'vendor',
      header: 'Bidder',
      sortValue: (s) => s.vendor_name,
      render: (s) =>
        s.eligible ? (
          <b>{s.vendor_name}</b>
        ) : (
          <>
            <div className="muted">{s.vendor_name}</div>
            <div className="small" style={{ color: 'var(--danger)' }}>
              {s.disqualifying_reason}
            </div>
          </>
        ),
    },
    {
      key: 'leveled',
      header: 'Leveled',
      numeric: true,
      sortValue: (s) => s.adjusted_total,
      render: (s) => (
        <span className={s.eligible ? undefined : 'muted'}>{money(s.adjusted_total)}</span>
      ),
    },
    ...FACTOR_ORDER.map<Column<VendorScore>>((factor) => ({
      key: factor,
      header: FACTOR_SHORT[factor],
      numeric: true,
      secondary: factor === 'schedule',
      sortValue: (s: VendorScore) => s.factors.find((f) => f.factor === factor)?.score ?? 0,
      render: (s: VendorScore) => {
        const f = s.factors.find((x) => x.factor === factor);
        return f ? <ScoreBar score={f.score} muted={!s.eligible} /> : <span className="muted">--</span>;
      },
    })),
    {
      key: 'score',
      header: 'Score',
      numeric: true,
      sortValue: (s) => s.total_score,
      render: (s) => (
        <b className={s.eligible ? undefined : 'muted'}>{s.total_score.toFixed(1)}</b>
      ),
    },
  ];

  return (
    <>
      <SectionHead eyebrow="Step 05 · Decide" title="Award recommendation">
        Price is necessary and not sufficient. This model weighs leveled cost against the things an
        estimator is also buying -- a safety record, a change-order history, a crew that can hit the
        date -- and states the trade in writing, because an evaluation that never writes its
        non-price factors down silently becomes price-only.
      </SectionHead>

      {!awardParity.ok && (
        <div className="card card-pad" style={{ marginBottom: 18, borderLeft: '3px solid var(--danger)' }}>
          <b>Parity failure.</b>{' '}
          <span className="small" style={{ color: 'var(--ink-2)' }}>
            The browser scoring disagrees with the Python pipeline on{' '}
            {awardParity.mismatches.length} vendor(s). These figures should not be trusted until
            that is resolved.
          </span>
        </div>
      )}

      <TabStrip tabs={tabs} active={tab} onChange={setTab} label="Award sections" />

      {tab === 'recommendation' && (
        <TabPanel tabKey="recommendation">
          {winner && (
            <div className="card card-pad" style={{ marginBottom: 18, borderLeft: '3px solid var(--accent)' }}>
              <div className="row row-wrap" style={{ marginBottom: 8 }}>
                <span className="eyebrow" style={{ flex: 1 }}>
                  Recommendation
                </span>
                {award.agrees_with_lowest_leveled ? (
                  <span className="pill p-ok">matches the lowest leveled bid</span>
                ) : (
                  <span className="pill p-warn">not the cheapest eligible bid</span>
                )}
              </div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>{winner.vendor_name}</h2>
              <div className="num" style={{ marginBottom: 10 }}>
                {money(winner.adjusted_total)} leveled · score {winner.total_score.toFixed(1)}
                {award.margin > 0 && (
                  <span className="muted small">
                    {' '}
                    · {award.margin.toFixed(1)} ahead of the runner-up
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--ink-2)', marginBottom: 14 }}>{award.narrative}</p>

              <div className="row row-wrap">
                {awarded ? (
                  <>
                    <span className="pill p-approved">soft award recorded: {awarded.vendor_name}</span>
                    <button className="btn" onClick={() => setAwardedVendor(null)}>
                      Undo
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => setAwardedVendor(winner.vendor_id)}>
                    Record soft award
                  </button>
                )}
                <span className="small muted">
                  Recorded in this browser only. Plumbline never executes an award or writes a
                  subcontract.
                </span>
              </div>
            </div>
          )}

          <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch', marginBottom: 18 }}>
            <div className="card card-pad" style={{ flex: '1 1 300px' }}>
              <div className="row row-wrap" style={{ marginBottom: 10 }}>
                <h3 style={{ flex: 1, margin: 0 }}>Weighting in force</h3>
                {weightsAreDefault ? (
                  <span className="pill p-ok">defaults</span>
                ) : (
                  <span className="pill p-warn">modified</span>
                )}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {FACTOR_ORDER.map((factor) => {
                  const share = weightTotal ? (weights[factor] / weightTotal) * 100 : 0;
                  return (
                    <div key={factor} className="row small">
                      <span style={{ flex: 1 }}>{FACTOR_LABELS[factor]}</span>
                      <span className="num muted">{share.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => setTab('weighting')}>
                Adjust the weights
              </button>
            </div>

            {winner && (
              <div className="card card-pad" style={{ flex: '2 1 400px' }}>
                <h3 style={{ marginTop: 0 }}>How {winner.vendor_name} scored</h3>
                <div className="stack" style={{ gap: 10 }}>
                  {winner.factors.map((factor) => (
                    <div key={factor.factor}>
                      <div className="row row-wrap" style={{ marginBottom: 3 }}>
                        <span style={{ flex: 1 }}>{factor.label}</span>
                        <span className="small muted num">
                          {factor.score.toFixed(0)} × {factor.weight.toFixed(0)}% ={' '}
                          {factor.weighted.toFixed(1)}
                        </span>
                      </div>
                      <ScoreBar score={factor.score} />
                      <div className="small muted" style={{ marginTop: 3 }}>
                        {factor.basis}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {excludedCount > 0 && (
            <div className="card card-pad" style={{ borderLeft: '3px solid var(--danger)' }}>
              <b>
                {excludedCount} bidder{excludedCount === 1 ? '' : 's'} never entered the ranking
              </b>
              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                {award.scores
                  .filter((s) => !s.eligible)
                  .map((s) => (
                    <div key={s.vendor_id} className="row row-wrap small">
                      <span style={{ flex: 1 }}>
                        <b>{s.vendor_name}</b>{' '}
                        <span className="muted num">
                          {money(s.adjusted_total)} · would have scored {s.total_score.toFixed(1)}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
              <div className="small muted" style={{ marginTop: 10 }}>
                A failing gate removes a bidder before price is discussed.{' '}
                <Link href={`/p/${projectId}/vendors/`}>Review the gates</Link>.
              </div>
            </div>
          )}
        </TabPanel>
      )}

      {tab === 'scoring' && (
        <TabPanel tabKey="scoring">
          <div className="card" style={{ overflow: 'hidden' }}>
            <DataTable
              rows={award.scores}
              columns={columns}
              rowKey={(s) => s.vendor_id}
              caption="Every bidder scored across the four award factors"
              initialSortKey="rank"
              onOpenRow={setOpenScore}
              rowAttrs={(s) => ({
                'data-recommended': s.rank === 1 ? '' : undefined,
                className: s.eligible ? undefined : 'row-excluded',
              })}
            />
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Sort any factor to see who leads on it. Gated bidders are scored but never ranked --
            seeing what a gate cost, especially when the excluded bidder was cheaper, is the point;
            letting that number become selectable is not.
          </p>
        </TabPanel>
      )}

      {tab === 'weighting' && (
        <TabPanel tabKey="weighting">
          <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch' }}>
            <div className="card card-pad" style={{ flex: '1 1 340px' }}>
              <div className="row row-wrap" style={{ marginBottom: 12 }}>
                <h3 style={{ flex: 1, margin: 0 }}>Weights</h3>
                {weightsAreDefault ? (
                  <span className="pill p-ok">pipeline defaults</span>
                ) : (
                  <>
                    <span className="pill p-warn">modified</span>
                    <button className="btn" onClick={resetWeights}>
                      Reset
                    </button>
                  </>
                )}
              </div>

              <div className="row row-wrap" style={{ gap: 8, marginBottom: 16 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="btn"
                    data-active={activePreset?.label === preset.label || undefined}
                    onClick={() => FACTOR_ORDER.forEach((f) => setWeight(f, preset.weights[f]))}
                    title={preset.note}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="stack" style={{ gap: 12 }}>
                {FACTOR_ORDER.map((factor) => {
                  const share = weightTotal ? (weights[factor] / weightTotal) * 100 : 0;
                  return (
                    <div key={factor}>
                      <div className="row row-wrap" style={{ marginBottom: 4 }}>
                        <label htmlFor={`weight-${factor}`} style={{ flex: 1 }}>
                          {FACTOR_LABELS[factor]}
                        </label>
                        <span className="num small muted">{share.toFixed(0)}% of the decision</span>
                      </div>
                      <input
                        id={`weight-${factor}`}
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={weights[factor]}
                        onChange={(e) => setWeight(factor, Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  );
                })}
              </div>

              {weightTotal !== 100 && (
                <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  Weights total {weightTotal}, so they are scored as proportions. Sliders will not
                  land on exactly 100, and refusing to score until they do would make the control
                  useless.
                </p>
              )}
            </div>

            {/* The consequence, beside the control -- otherwise moving a slider
                means switching tabs to find out whether anything happened. */}
            <div className="card card-pad" style={{ flex: '1 1 300px' }}>
              <h3 style={{ marginTop: 0 }}>Ranking as weighted</h3>
              <div className="stack" style={{ gap: 8 }}>
                {award.scores
                  .filter((s) => s.eligible)
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .map((s) => (
                    <div key={s.vendor_id} className="row row-wrap">
                      <span className="muted mono small">{s.rank}.</span>
                      <span style={{ flex: 1 }}>{s.vendor_name}</span>
                      <span className="num">{s.total_score.toFixed(1)}</span>
                    </div>
                  ))}
              </div>
              {excludedCount > 0 && (
                <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
                  {excludedCount} gated bidder{excludedCount === 1 ? '' : 's'} excluded regardless of
                  weighting. No weighting recovers a disqualified bidder.
                </p>
              )}
            </div>
          </div>
        </TabPanel>
      )}

      <Drawer
        open={openScore !== null}
        onClose={() => setOpenScore(null)}
        eyebrow={
          openScore?.eligible ? `Ranked ${openScore.rank}` : 'Excluded before scoring'
        }
        title={openScore?.vendor_name ?? ''}
      >
        {openScore && (
          <>
            {!openScore.eligible && (
              <div
                className="card card-pad"
                style={{ marginBottom: 16, borderLeft: '3px solid var(--danger)' }}
              >
                {openScore.disqualifying_reason}
              </div>
            )}

            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="row row-wrap small">
                <span className="muted" style={{ flex: 1 }}>
                  Submitted
                </span>
                <span className="num">{money(openScore.submitted_total)}</span>
              </div>
              <div className="row row-wrap small" style={{ marginTop: 6 }}>
                <span className="muted" style={{ flex: 1 }}>
                  Leveled
                </span>
                <span className="num">{money(openScore.adjusted_total)}</span>
              </div>
              <div
                className="row row-wrap"
                style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}
              >
                <b style={{ flex: 1 }}>Weighted score</b>
                <b className="num">{openScore.total_score.toFixed(1)}</b>
              </div>
            </div>

            <div className="stack" style={{ gap: 14 }}>
              {openScore.factors.map((factor) => (
                <div key={factor.factor}>
                  <div className="row row-wrap" style={{ marginBottom: 4 }}>
                    <b style={{ flex: 1 }}>{factor.label}</b>
                    <span className="small muted num">
                      {factor.score.toFixed(0)} × {factor.weight.toFixed(0)}% ={' '}
                      {factor.weighted.toFixed(1)}
                    </span>
                  </div>
                  <ScoreBar score={factor.score} muted={!openScore.eligible} />
                  <div className="small" style={{ color: 'var(--ink-2)', marginTop: 4 }}>
                    {factor.basis}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
