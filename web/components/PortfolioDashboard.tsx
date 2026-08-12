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
import { useRouter } from 'next/navigation';
import type { PortfolioTotals, ProjectHealth, RagLevel } from '@/lib/portfolio';
import { usePendingCounts } from '@/lib/pending';
import { useShell } from '@/lib/shell';
import { KpiTile, RagPill } from './Bits';
import { BudgetBar } from './BudgetBar';
import { scaleTicks } from './ChartScale';
import { moneyShort, formatDay, relativeDays } from '@/lib/format';
import { packageTiming } from '@/lib/timeline';
import { getProject } from '@/lib/projects';
import { RowActions } from './RowActions';
import { money, signedMoney } from '@/lib/format';

type Filter = 'over-budget' | 'findings';
type Status = 'all' | 'flag' | 'watch' | 'ok';
type SortKey = 'name' | 'budget' | 'variance' | 'pending';
type Density = 'comfortable' | 'compact';

const FILTER_LABEL: Record<Filter, string> = {
  'over-budget': 'Packages over budget',
  findings: 'Packages with high-severity findings',
};

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Package name (A to Z)',
  budget: 'Budget (high to low)',
  variance: 'Variance (worst first)',
  pending: 'Pending reviews (most first)',
};

const STATUS_LABEL: Record<Status, string> = {
  all: 'All statuses',
  flag: 'Flagged',
  watch: 'Watch',
  ok: 'On track',
};

function worstLevel(p: ProjectHealth): RagLevel {
  return p.overall;
}

export function PortfolioDashboard({ portfolio }: { portfolio: PortfolioTotals }) {
  const router = useRouter();
  const { query, setQuery } = useShell();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [status, setStatus] = useState<Status>('all');
  const [sortKey, setSortKey] = useState<SortKey>('variance');
  const [density, setDensity] = useState<Density>('comfortable');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const pending = usePendingCounts(portfolio.projects.map((p) => p.projectId));

  const toggle = (next: Filter) => setFilter((current) => (current === next ? null : next));

  const needle = query.trim().toLowerCase();
  const rows = portfolio.projects
    .filter((p) => {
      if (filter === 'over-budget' && p.costVariance >= 0) return false;
      if (filter === 'findings' && p.highFindingsCount === 0) return false;
      if (status === 'flag' && worstLevel(p) !== 'red') return false;
      if (status === 'watch' && worstLevel(p) !== 'amber') return false;
      if (status === 'ok' && worstLevel(p) !== 'green') return false;
      if (needle && !`${p.projectName} ${p.packageLabel}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'name') return a.projectName.localeCompare(b.projectName);
      if (sortKey === 'budget') return b.budget - a.budget;
      if (sortKey === 'pending') return (pending[b.projectId] ?? 0) - (pending[a.projectId] ?? 0);
      return a.costVariance - b.costVariance;
    });

  const filtersApplied = Boolean(filter) || status !== 'all' || needle.length > 0;
  const clearAll = () => {
    setFilter(null);
    setStatus('all');
    setQuery('');
  };

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

      {/* No overflow clipping on this card: it would trap both the sticky
          table header and the row-action menus inside it. Nothing here needs
          clipping anyway, since the control bar and legend cover the rounded
          corners. */}
      <div className="card" style={{ marginBottom: 26 }}>
        <div className="table-controls">
          <label className="control">
            <span className="control-label">Search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Package name or number"
              aria-label="Filter packages by name or number"
            />
          </label>

          <label className="control">
            <span className="control-label">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              aria-label="Filter packages by status"
            >
              {(Object.keys(STATUS_LABEL) as Status[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span className="control-label">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort packages"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <div className="control control-density">
            <span className="control-label">Density</span>
            <div className="seg" role="group" aria-label="Row density">
              <button
                type="button"
                data-active={density === 'comfortable'}
                onClick={() => setDensity('comfortable')}
              >
                Comfortable
              </button>
              <button
                type="button"
                data-active={density === 'compact'}
                onClick={() => setDensity('compact')}
              >
                Compact
              </button>
            </div>
          </div>

          <div className="table-controls-count">
            {rows.length} of {portfolio.projectCount} packages
          </div>
        </div>

        {filter && (
          <div className="table-chips">
            <span className="filter-chip">
              {FILTER_LABEL[filter]}
              <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter">
                ✕
              </button>
            </span>
          </div>
        )}

        <div className="table-scroll" data-sticky="true">
          <table className="pkg-table" data-density={density}>
            <thead>
              <tr>
                <th>Package</th>
                <th className="right">Budget</th>
                <th className="right">Leveled low bid</th>
                <th className="right">Variance</th>
                <th className="bbar-col">
                  Budget vs leveled
                  <span className="bbar-axis" aria-hidden="true">
                    <span className="bbar-axis-tick" style={{ left: '0%' }}>
                      $0
                    </span>
                    {/* Every gridline, but only every other label: five
                        currency labels will not fit legibly across 160px. */}
                    {ticks
                      .filter((_, i) => i % 2 === 0)
                      .map((t) => (
                        <span
                          key={t.value}
                          className="bbar-axis-tick"
                          style={{ left: `${t.fraction * 100}%` }}
                        >
                          {moneyShort(t.value)}
                        </span>
                      ))}
                  </span>
                </th>
                <th>Bid due</th>
                <th>Last reviewed</th>
                <th>Scope</th>
                <th>Cost</th>
                <th>Risk</th>
                <th className="right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const timing = packageTiming(p.projectId, getProject(p.projectId)!);
                return (
                <tr
                  key={p.projectId}
                  className="pkg-row"
                  onClick={() => router.push(`/p/${p.projectId}/`)}
                >
                  <td>
                    <Link
                      href={`/p/${p.projectId}/`}
                      className="pkg-name"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.projectName}
                    </Link>
                    {pending[p.projectId] > 0 && (
                      <span className="count-badge" title="Submissions still awaiting human review">
                        {pending[p.projectId]} pending
                      </span>
                    )}
                    <div className="small muted">
                      {p.packageLabel} · last bid {relativeDays(timing.daysSinceLastSubmission)}
                    </div>
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
                      ticks={ticks}
                    />
                  </td>
                  <td className="date-cell">
                    <span className="num">{formatDay(timing.bidDueAt)}</span>
                    <span className="small muted">{relativeDays(timing.daysSinceBidDue)}</span>
                  </td>
                  <td className="date-cell">
                    {timing.lastReviewedAt ? (
                      <>
                        <span className="num">{formatDay(timing.lastReviewedAt)}</span>
                        <span className="small muted">
                          {relativeDays(timing.daysSinceLastReview!)}
                        </span>
                      </>
                    ) : (
                      <span className="small muted">Not opened yet</span>
                    )}
                  </td>
                  <td>
                    <RagPill
                      level={p.scope}
                      title={`${p.scopeCovered} of ${p.scopeRequired} required scope items covered`}
                    />
                  </td>
                  <td>
                    <RagPill
                      level={p.cost}
                      title={`Leveled low bid is ${p.costVariancePct.toFixed(1)}% against budget`}
                    />
                  </td>
                  <td>
                    <RagPill
                      level={p.risk}
                      title={`${p.highFindingsCount} high-severity findings`}
                    />
                  </td>
                  <td className="right">
                    <RowActions
                      projectId={p.projectId}
                      projectName={p.projectName}
                      open={openMenu === p.projectId}
                      onToggle={() =>
                        setOpenMenu((id) => (id === p.projectId ? null : p.projectId))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="table-empty">
            <p>
              No package matches the current search and filters. Three packages are loaded, all
              synthetic.
            </p>
            <button className="btn" type="button" onClick={clearAll}>
              Clear search and filters
            </button>
          </div>
        )}

        <div className="table-legend">
          <div>
            <RagPill level="green" title="Threshold met" /> Scope: every required item covered ·
            Cost: leveled low bid at or under budget · Risk: no high-severity findings
          </div>
          <div>
            <RagPill level="amber" title="Worth watching" /> Scope: 80 to 99% covered · Cost: up to
            10% over budget · Risk: one or two high-severity findings
          </div>
          <div>
            <RagPill level="red" title="Needs a decision" /> Scope: under 80% covered · Cost: more
            than 10% over budget · Risk: three or more high-severity findings
          </div>
          <div className="table-legend-chart">
            <span>
              <span className="swatch" data-part="submitted" /> the lowest price a bidder actually
              submitted
            </span>
            <span>
              <span className="swatch" data-part="leveling" /> what gets added once the scope that
              bidder left out is priced in
            </span>
            <span>
              <span className="swatch" data-part="budget" /> the package budget, red where the
              leveled bid crosses it
            </span>
          </div>
        </div>
      </div>

      {filtersApplied && rows.length > 0 && (
        <p className="small muted" style={{ marginTop: -14, marginBottom: 26 }}>
          Filters are applied.{' '}
          <button className="linkish" type="button" onClick={clearAll}>
            Show all {portfolio.projectCount} packages
          </button>
        </p>
      )}
    </>
  );
}
