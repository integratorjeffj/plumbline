/**
 * The time dimension the console was missing.
 *
 * Plumbline's pipeline records when a submission arrived and nothing else: it
 * has no event log, no review audit trail, and no bid calendar. Everything in
 * this module that is not a submission timestamp is therefore SYNTHETIC, and
 * every surface that renders it says so.
 *
 * Two rules keep that honest rather than merely disclosed:
 *
 * 1. Nothing here reads the wall clock. "Now" is the latest submission in the
 *    dataset, exported as PORTFOLIO_AS_OF. A static export prerendered at
 *    build time that computed "days ago" against Date.now() would disagree
 *    with itself between the server render and the browser, and would drift
 *    further every day the demo sits unvisited.
 *
 * 2. Every generated figure is seeded from the package it describes, so the
 *    same package always produces the same dates, and totals are pinned to
 *    real engine output where a real total exists: the activity strip's
 *    raised series sums to the actual finding count, and its open backlog
 *    equals the actual high-severity count.
 */

import { PROJECT_IDS, getProject } from './projects';
import type { PipelineData } from './types';

const DAY_MS = 86_400_000;

/** FNV-1a, so a package id maps to a stable seed without a dependency. */
function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, deterministic, and adequate for laying out demo dates. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lastSubmissionMs(data: PipelineData): number {
  return Math.max(...data.submissions.map((s) => new Date(s.email.received_at).getTime()));
}

/**
 * The console's "now": the most recent submission anywhere in the portfolio.
 * Fixed by the data, not by the clock, so every relative figure below is
 * reproducible.
 */
export const PORTFOLIO_AS_OF_MS = Math.max(
  ...PROJECT_IDS.map((id) => lastSubmissionMs(getProject(id)!))
);

export const PORTFOLIO_AS_OF = new Date(PORTFOLIO_AS_OF_MS).toISOString();

function wholeDaysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

export interface PackageTiming {
  lastSubmissionAt: string;
  daysSinceLastSubmission: number;
  /** Synthetic. Seeded from the package id. */
  bidDueAt: string;
  /** Positive once the bid date has passed, negative while it is still ahead. */
  daysSinceBidDue: number;
  /** Synthetic, or null for a package nobody has opened yet. */
  lastReviewedAt: string | null;
  daysSinceLastReview: number | null;
}

export function packageTiming(projectId: string, data: PipelineData): PackageTiming {
  const next = rng(hashSeed(projectId));
  const lastSub = lastSubmissionMs(data);
  const daysSinceLastSubmission = wholeDaysBetween(lastSub, PORTFOLIO_AS_OF_MS);

  // A bid date lands a few days after the last proposal arrives, which is how
  // it reads on a real package: the stragglers come in right up against it.
  const dueMs = lastSub + (1 + Math.floor(next() * 6)) * DAY_MS;

  // The package whose bids landed most recently has not been opened yet.
  // Deciding this from the data rather than from the seed means the table
  // always renders the never-reviewed case, and renders it on the one package
  // where it makes sense: the proposals arrived today.
  const reviewedMs =
    daysSinceLastSubmission === 0
      ? null
      : Math.min(lastSub + (1 + Math.floor(next() * 3)) * DAY_MS, PORTFOLIO_AS_OF_MS);

  return {
    lastSubmissionAt: new Date(lastSub).toISOString(),
    daysSinceLastSubmission,
    bidDueAt: new Date(dueMs).toISOString(),
    daysSinceBidDue: wholeDaysBetween(dueMs, PORTFOLIO_AS_OF_MS),
    lastReviewedAt: reviewedMs === null ? null : new Date(reviewedMs).toISOString(),
    daysSinceLastReview:
      reviewedMs === null ? null : wholeDaysBetween(reviewedMs, PORTFOLIO_AS_OF_MS),
  };
}

export interface ActivityDay {
  dateISO: string;
  raised: number;
  resolved: number;
}

/**
 * Spread `total` across `days` buckets with a seeded distribution whose
 * integers sum exactly to `total` (largest remainder, so nothing is lost to
 * rounding and the strip's totals match the captions beneath it).
 */
function distribute(total: number, days: number, seed: number): number[] {
  if (total <= 0) return new Array(days).fill(0);
  const next = rng(seed);
  const weights = Array.from({ length: days }, () => 0.2 + next());
  const sum = weights.reduce((a, w) => a + w, 0);
  const exact = weights.map((w) => (w / sum) * total);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, n) => a + n, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]++;
    remainder--;
  }
  return floors;
}

/**
 * Findings raised against findings cleared, over the `days` leading up to
 * PORTFOLIO_AS_OF.
 *
 * Both series are pinned to figures the engine actually produces: every
 * finding in the portfolio is raised exactly once across the window, and the
 * count still open at the end equals the portfolio's high-severity count. The
 * day-to-day shape is synthetic; the endpoints are not.
 */
export function activityStrip(days = 14): ActivityDay[] {
  let totalFindings = 0;
  let totalHigh = 0;
  for (const id of PROJECT_IDS) {
    const data = getProject(id)!;
    totalFindings += data.findings.length;
    totalHigh += data.findings.filter((f) => f.severity === 'HIGH').length;
  }

  const raised = distribute(totalFindings, days, hashSeed('raised'));
  const resolvedTarget = Math.max(0, totalFindings - totalHigh);
  const resolved = distribute(resolvedTarget, days, hashSeed('resolved'));

  // Nothing can be cleared before it is raised, so walk the window keeping a
  // running backlog and push any excess forward.
  let backlog = 0;
  let carried = 0;
  const out: ActivityDay[] = [];
  for (let i = 0; i < days; i++) {
    backlog += raised[i];
    const want = resolved[i] + carried;
    const done = Math.min(want, backlog);
    carried = want - done;
    backlog -= done;
    out.push({
      dateISO: new Date(PORTFOLIO_AS_OF_MS - (days - 1 - i) * DAY_MS).toISOString(),
      raised: raised[i],
      resolved: done,
    });
  }
  return out;
}
