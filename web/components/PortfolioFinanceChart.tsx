'use client';

/**
 * One shared-scale bar per bid package: submitted low bid, the delta once
 * scope gaps are priced, and a budget tick -- the portfolio-level analog of
 * the per-package leveling bars on the Compare page, reusing the same
 * zero-dependency flex-width-div technique rather than pulling in a charting
 * library for three to six bars.
 */

import Link from 'next/link';
import type { ProjectHealth } from '@/lib/portfolio';
import { money, percent } from '@/lib/format';

export function PortfolioFinanceChart({ projects }: { projects: ProjectHealth[] }) {
  const maxScale = Math.max(
    ...projects.flatMap((p) => [p.budget, p.lowestSubmittedTotal, p.lowestAdjustedTotal])
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      {projects.map((p) => {
        const submittedPct = (p.lowestSubmittedTotal / maxScale) * 100;
        const deltaAmount = Math.max(0, p.lowestAdjustedTotal - p.lowestSubmittedTotal);
        const deltaPct = (deltaAmount / maxScale) * 100;
        const budgetPct = (p.budget / maxScale) * 100;

        return (
          <div key={p.projectId} className="card card-pad">
            <div className="row row-wrap" style={{ marginBottom: 10 }}>
              <Link href={`/p/${p.projectId}/`} className="mono" style={{ flex: 1, fontWeight: 600 }}>
                {p.projectName}
              </Link>
              <span className="small num">
                Budget {money(p.budget)} · Leveled low {money(p.lowestAdjustedTotal)}{' '}
                <span className="muted">
                  ({p.costVariance >= 0 ? 'under' : 'over'} by {money(Math.abs(p.costVariance))},{' '}
                  {percent(p.costVariancePct)})
                </span>
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                height: 22,
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ width: `${submittedPct}%`, background: 'var(--accent)' }} />
              {deltaAmount > 0 && (
                <div
                  title={`Scope priced once leveled: ${money(deltaAmount, 2)}`}
                  style={{ width: `${deltaPct}%`, background: 'var(--warn)', borderLeft: '1px solid var(--surface)' }}
                />
              )}
              <div
                title={`Package budget ${money(p.budget)}`}
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
          </div>
        );
      })}

      <div className="small muted row" style={{ gap: 16 }}>
        <span>
          <span
            style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2, marginRight: 5 }}
          />
          lowest submitted
        </span>
        <span>
          <span
            style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--warn)', borderRadius: 2, marginRight: 5 }}
          />
          priced once leveled
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--danger)', marginRight: 5 }} />
          package budget
        </span>
      </div>
    </div>
  );
}
