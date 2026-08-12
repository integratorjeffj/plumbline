/**
 * Shared scale machinery for the two places this app draws bars: the
 * budget-vs-leveled column on the package table and the leveling bars on a
 * package's compare view.
 *
 * Both were previously bars with no axis at all, which meant a reader could
 * see that one was longer than another but had no way to read a value off
 * them. One tick generator and one axis component keeps the two honest about
 * using the same rounding.
 */

import { moneyShort } from '@/lib/format';

export interface Tick {
  value: number;
  /** Position along the track, 0 to 1. */
  fraction: number;
}

// Rounded stops a reader can do arithmetic against. The first candidate that
// yields at most five gridlines wins, so a $340k package and an $860k program
// both land on labels that read cleanly.
const STEPS = [10_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000];

export function scaleTicks(maxScale: number): Tick[] {
  const step = STEPS.find((s) => maxScale / s <= 5) ?? 5_000_000;
  const out: Tick[] = [];
  for (let v = step; v < maxScale; v += step) out.push({ value: v, fraction: v / maxScale });
  return out;
}

/** Vertical gridlines drawn inside a bar track. */
export function Gridlines({ ticks }: { ticks: Tick[] }) {
  return (
    <>
      {ticks.map((t) => (
        <span key={t.value} className="chart-grid" style={{ left: `${t.fraction * 100}%` }} />
      ))}
    </>
  );
}

/**
 * The labeled axis beneath a set of tracks. `budget` adds the annotation that
 * names what the vertical line in every track actually is.
 */
export function ChartAxis({
  ticks,
  maxScale,
  budget,
}: {
  ticks: Tick[];
  maxScale: number;
  budget?: number;
}) {
  return (
    <div className="chart-axis">
      <span className="chart-axis-tick" style={{ left: '0%' }}>
        $0
      </span>
      {ticks.map((t) => (
        <span key={t.value} className="chart-axis-tick" style={{ left: `${t.fraction * 100}%` }}>
          {moneyShort(t.value)}
        </span>
      ))}
      {budget !== undefined && (
        <span className="chart-axis-budget" style={{ left: `${(budget / maxScale) * 100}%` }}>
          Budget {moneyShort(budget)}
        </span>
      )}
    </div>
  );
}
