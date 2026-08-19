'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { EmptyState } from '@/components/EmptyState';
import { GatePill, ScoreBar, SectionHead } from '@/components/Bits';
import { FACTOR_LABELS, FACTOR_ORDER, FACTOR_SHORT } from '@/lib/award';
import { money } from '@/lib/format';

/** Named presets, so the effect of a weighting change is one click away. */
const PRESETS: { label: string; note: string; weights: Record<string, number> }[] = [
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
    data,
    vendors,
    award,
    awardParity,
    weights,
    weightsAreDefault,
    setWeight,
    resetWeights,
    awardedVendorId,
    setAwardedVendor,
  } = useStore();

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

  const ranked = award.scores
    .filter((s) => s.eligible)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const excluded = award.scores
    .filter((s) => !s.eligible)
    .sort((a, b) => a.adjusted_total - b.adjusted_total);

  const winner = award.scores.find((s) => s.vendor_id === award.recommended_vendor_id);
  const awarded = award.scores.find((s) => s.vendor_id === awardedVendorId);
  const weightTotal = FACTOR_ORDER.reduce((sum, f) => sum + weights[f], 0);

  const activePreset = PRESETS.find((preset) =>
    FACTOR_ORDER.every((f) => preset.weights[f] === weights[f])
  );

  return (
    <>
      <SectionHead eyebrow="Step 05 · Decide" title="Award recommendation">
        Price is necessary and not sufficient. This model weighs leveled cost against the things
        an estimator is also buying -- a safety record, a change-order history, a crew that can
        hit the date -- and states the trade in writing, because an evaluation that never writes
        its non-price factors down silently becomes price-only.
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

      {/* ---------- weights ---------- */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row row-wrap" style={{ marginBottom: 12 }}>
          <h3 style={{ flex: 1, margin: 0 }}>Weighting</h3>
          {weightsAreDefault ? (
            <span className="pill p-ok">pipeline defaults</span>
          ) : (
            <>
              <span className="pill p-warn">modified</span>
              <button className="btn" onClick={resetWeights}>
                Reset to defaults
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
          <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>
            Weights total {weightTotal}, so they are scored as proportions. Sliders will not land
            on exactly 100, and refusing to score until they do would make the control useless.
          </p>
        )}
      </div>

      {/* ---------- recommendation ---------- */}
      {winner && (
        <div
          className="card card-pad"
          style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}
        >
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
              <span className="muted small"> · {award.margin.toFixed(1)} ahead of the runner-up</span>
            )}
          </div>
          <p style={{ color: 'var(--ink-2)', marginBottom: 14 }}>{award.narrative}</p>

          <div className="row row-wrap">
            {awarded ? (
              <>
                <span className="pill p-approved">
                  soft award recorded: {awarded.vendor_name}
                </span>
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

      {/* ---------- scoring table ---------- */}
      <h2 style={{ marginBottom: 12 }}>Scoring</h2>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Bidder</th>
                <th style={{ textAlign: 'right' }}>Leveled</th>
                {FACTOR_ORDER.map((factor) => (
                  <th key={factor} style={{ textAlign: 'right' }}>
                    {FACTOR_SHORT[factor]}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((score) => (
                <tr key={score.vendor_id} data-recommended={score.rank === 1 || undefined}>
                  <td className="num">{score.rank}</td>
                  <td>
                    <b>{score.vendor_name}</b>
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {money(score.adjusted_total)}
                  </td>
                  {FACTOR_ORDER.map((factor) => {
                    const f = score.factors.find((x) => x.factor === factor);
                    return (
                      <td key={factor} style={{ textAlign: 'right' }} title={f?.basis}>
                        {f ? <ScoreBar score={f.score} /> : <span className="muted">--</span>}
                      </td>
                    );
                  })}
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {score.total_score.toFixed(1)}
                  </td>
                </tr>
              ))}

              {excluded.map((score) => (
                <tr key={score.vendor_id} className="row-excluded">
                  <td>
                    <GatePill status="fail" />
                  </td>
                  <td>
                    <div className="muted">{score.vendor_name}</div>
                    <div className="small" style={{ color: 'var(--danger)' }}>
                      {score.disqualifying_reason}
                    </div>
                  </td>
                  <td className="num muted" style={{ textAlign: 'right' }}>
                    {money(score.adjusted_total)}
                  </td>
                  {FACTOR_ORDER.map((factor) => {
                    const f = score.factors.find((x) => x.factor === factor);
                    return (
                      <td key={factor} style={{ textAlign: 'right' }} title={f?.basis}>
                        {f ? (
                          <ScoreBar score={f.score} muted />
                        ) : (
                          <span className="muted">--</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="num muted" style={{ textAlign: 'right' }}>
                    {score.total_score.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 30 }}>
        Gated bidders are scored but never ranked. Seeing what a gate cost -- especially when the
        excluded bidder was cheaper -- is the point; letting that number become selectable is not.{' '}
        <Link href={`/p/${projectId}/vendors/`}>Review the gates</Link>.
      </p>

      {/* ---------- factor detail for the recommendation ---------- */}
      {winner && (
        <>
          <h2 style={{ marginBottom: 12 }}>How {winner.vendor_name} scored</h2>
          <div className="stack" style={{ gap: 8 }}>
            {winner.factors.map((factor) => (
              <div key={factor.factor} className="card card-pad">
                <div className="row row-wrap" style={{ marginBottom: 4 }}>
                  <b style={{ flex: 1 }}>{factor.label}</b>
                  <span className="small muted num">
                    {factor.score.toFixed(0)} × {factor.weight.toFixed(0)}% ={' '}
                    {factor.weighted.toFixed(1)}
                  </span>
                </div>
                <div className="small" style={{ color: 'var(--ink-2)' }}>
                  {factor.basis}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
