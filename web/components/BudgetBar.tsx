'use client';

/**
 * One package's money, in a table cell.
 *
 * This replaces a separate finance chart section that showed the same three
 * numbers the table already had in columns. Inline, on the row it describes,
 * the bar earns its space: it is the only place a reader sees how far the
 * leveled bid sits from the budget line without doing subtraction.
 *
 * Every bar on the page shares one scale, set by the largest figure in the
 * portfolio, so bar length is comparable down the column. Zero dependencies:
 * flex-width divs, the same technique the per-package compare view uses.
 */

import { money } from '@/lib/format';
import { Gridlines, type Tick } from './ChartScale';

export function BudgetBar({
  budget,
  submitted,
  adjusted,
  maxScale,
  ticks,
}: {
  budget: number;
  submitted: number;
  adjusted: number;
  maxScale: number;
  ticks: Tick[];
}) {
  const submittedPct = (Math.min(submitted, adjusted) / maxScale) * 100;
  const levelingDelta = Math.max(0, adjusted - submitted);
  const deltaPct = (levelingDelta / maxScale) * 100;
  const budgetPct = (budget / maxScale) * 100;
  const overBudget = adjusted > budget;

  return (
    <div
      className="bbar"
      role="img"
      aria-label={`Lowest submitted ${money(submitted)}, ${money(adjusted)} once leveled, against a budget of ${money(budget)}`}
    >
      <Gridlines ticks={ticks} />
      <span className="bbar-fill" data-part="submitted" style={{ width: `${submittedPct}%` }} />
      {levelingDelta > 0 && (
        <span
          className="bbar-fill"
          data-part="leveling"
          style={{ left: `${submittedPct}%`, width: `${deltaPct}%` }}
        />
      )}
      <span className="bbar-budget" data-over={overBudget} style={{ left: `${budgetPct}%` }} />
    </div>
  );
}
