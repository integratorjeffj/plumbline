'use client';

/**
 * The portfolio KPI row and the package table it filters.
 *
 * These two are one component because the tiles are not decoration: pressing
 * "over budget" or "high-severity findings" narrows the table beneath them.
 * Splitting them would mean lifting filter state into a third place that
 * neither of them owns.
 */

import { useState } from 'react';
import Link from 'next/link';
import type { PortfolioTotals } from '@/lib/portfolio';
import { usePendingCounts } from '@/lib/pending';
import { HealthDot, KpiTile } from './Bits';
import { BudgetBar, scaleTicks } from './BudgetBar';
import { money, signedMoney } from '@/lib/format';

type Filter = 'over-budget' | 'findings';

const FILTER_LABEL: Record<Filter, string> = {
  'over-budget': 'Packages over budget',
  findings: 'Packages with high-severity findings',
};

export function PortfolioDashboard({ portfolio }: { portfolio: PortfolioTotals }) {
  const [filter, setFilter] = useState<Filter | null>(null);
  const pending = usePendingCounts(portfolio.projects.map((p) => p.projectId));

  const toggle = (next: Filter) => setFilter((current) => (current === next ? null : next));

  const rows = portfolio.projects.filter((p) => {
    if (filter === 'over-budget') return p.costVariance < 0;
    if (filter === 'findings') return p.highFindingsCount > 0;
    return true;
  });

  const underBudget = portfolio.totalVarianceToBudget >= 0;

  // One scale for every bar in the column, so their lengths are comparable.
  const maxScale = Math.max(
    ...portfolio.projects.flatMap((p) => [p.budget, p.lowestSubmittedTotal, p.lowestAdjustedTotal])
  );
  const ticks = scaleTicks(maxScale);

  return (
    <>
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <KpiTile
          icon="packages"
          label="Packages"
          value={String(portfolio.projectCount)}
          note="Open for bid leveling"
        />
        <KpiTile
          icon="wallet"
          label="Program budget"
          value={money(portfolio.totalBudget)}
          note="Sum of every package budget"
        />
        <KpiTile
          icon="scale"
          label="Leveled bid exposure"
          value={money(portfolio.totalBestValueExposure)}
          note="Each package's lowest adjusted bid, before award"
        />
        <KpiTile
          icon="wallet"
          label="Variance to budget"
          value={signedMoney(portfolio.totalVarianceToBudget)}
          note={
            portfolio.projectsOverBudgetCount === 0
              ? 'Every package inside its budget'
              : `${portfolio.projectsOverBudgetCount} of ${portfolio.projectCount} packages over`
          }
          tone={underBudget ? 'ok' : 'danger'}
          onFilter={() => toggle('over-budget')}
          active={filter === 'over-budget'}
          filterLabel="Show packages over budget"
        />
        <KpiTile
          icon="alert"
          label="High-severity findings"
          value={String(portfolio.totalHighFindings)}
          note={
            portfolio.totalHighFindings === 0
              ? 'Nothing flagged for a reviewer'
              : 'Raised by the rules engine, awaiting review'
          }
          tone={portfolio.totalHighFindings > 0 ? 'danger' : 'ok'}
          onFilter={() => toggle('findings')}
          active={filter === 'findings'}
          filterLabel="Show packages with findings"
        />
      </div>

      {filter && (
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="filter-chip">
            {FILTER_LABEL[filter]}
            <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter">
              ✕
            </button>
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Package health</h2>
      <div className="card" style={{ marginBottom: 26, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th className="right">Budget</th>
                <th className="right">Leveled low bid</th>
                <th className="right">Variance</th>
                <th className="bbar-col">Budget vs leveled</th>
                <th>Scope</th>
                <th>Cost</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.projectId}>
                  <td>
                    <Link href={`/p/${p.projectId}/`} style={{ fontWeight: 600 }}>
                      {p.projectName}
                    </Link>
                    {pending[p.projectId] > 0 && (
                      <span className="count-badge" title="Submissions still awaiting human review">
                        {pending[p.projectId]} pending
                      </span>
                    )}
                    <div className="small muted">{p.packageLabel}</div>
                  </td>
                  <td className="right num">{money(p.budget)}</td>
                  <td className="right num">{money(p.lowestAdjustedTotal)}</td>
                  <td
                    className="right num"
                    style={{ color: p.costVariance < 0 ? 'var(--danger)' : 'var(--ok)' }}
                  >
                    {signedMoney(p.costVariance)}
                  </td>
                  <td className="bbar-col">
                    <BudgetBar
                      budget={p.budget}
                      submitted={p.lowestSubmittedTotal}
                      adjusted={p.lowestAdjustedTotal}
                      maxScale={maxScale}
                      ticks={ticks.map((t) => t.fraction)}
                    />
                  </td>
                  <td>
                    <HealthDot
                      level={p.scope}
                      label={`Scope: ${p.scopeCovered} of ${p.scopeRequired} required items covered`}
                    />
                  </td>
                  <td>
                    <HealthDot level={p.cost} label={`Cost: ${p.costVariancePct.toFixed(1)}% vs budget`} />
                  </td>
                  <td>
                    <HealthDot level={p.risk} label={`Risk: ${p.highFindingsCount} high-severity findings`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="table-empty">
            <p>No package matches {FILTER_LABEL[filter!].toLowerCase()}.</p>
            <button className="btn" type="button" onClick={() => setFilter(null)}>
              Clear the filter
            </button>
          </div>
        )}
      </div>
    </>
  );
}
