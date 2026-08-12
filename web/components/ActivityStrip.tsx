/**
 * Findings raised against findings cleared, over the fortnight leading up to
 * the portfolio's most recent submission.
 *
 * The console had no time axis at all before this: every number it showed was
 * a snapshot, so a reviewer could see that eight high-severity findings
 * existed but not whether that pile was growing or shrinking. That trend is
 * the thing a program manager actually acts on.
 *
 * The day-to-day shape is generated, and the caption says so. What is not
 * generated: the raised series sums to the real finding count, and the
 * backlog left standing at the end equals the real high-severity count.
 */

import { activityStrip } from '@/lib/timeline';
import { formatDay } from '@/lib/format';

export function ActivityStrip({ days = 14 }: { days?: number }) {
  const series = activityStrip(days);
  const peak = Math.max(1, ...series.map((d) => Math.max(d.raised, d.resolved)));
  const totalRaised = series.reduce((sum, d) => sum + d.raised, 0);
  const totalResolved = series.reduce((sum, d) => sum + d.resolved, 0);

  return (
    <div className="card card-pad">
      <div className="row row-wrap" style={{ marginBottom: 14 }}>
        <h2 className="card-title" style={{ flex: 1 }}>Review activity</h2>
        {/* Sans, not the mono data face: this is a sentence that happens to
            contain numbers, not a column of figures to be compared. */}
        <span className="small muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {totalRaised} raised · {totalResolved} cleared · {totalRaised - totalResolved} still open
        </span>
      </div>

      <div className="activity" role="img" aria-label={activityDescription(totalRaised, totalResolved, days)}>
        {series.map((d) => (
          <div key={d.dateISO} className="activity-day" title={`${formatDay(d.dateISO)}: ${d.raised} raised, ${d.resolved} cleared`}>
            <span className="activity-bars">
              <span
                className="activity-bar"
                data-part="raised"
                style={{ height: `${(d.raised / peak) * 100}%` }}
              />
              <span
                className="activity-bar"
                data-part="resolved"
                style={{ height: `${(d.resolved / peak) * 100}%` }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="activity-axis">
        <span>{formatDay(series[0].dateISO)}</span>
        <span>{formatDay(series[series.length - 1].dateISO)}</span>
      </div>

      <div className="chart-legend">
        <span>
          <span className="swatch" data-part="raised" /> findings the rules engine raised that day
        </span>
        <span>
          <span className="swatch" data-part="resolved" /> findings a reviewer cleared that day
        </span>
        <span className="muted">
          Peak {peak} in a day. Daily shape is synthetic; the totals are the engine's own.
        </span>
      </div>
    </div>
  );
}

function activityDescription(raised: number, resolved: number, days: number): string {
  return `Over ${days} days, ${raised} findings were raised and ${resolved} were cleared, leaving ${raised - resolved} open.`;
}
