/**
 * Client-side leveling engine.
 *
 * This is a deliberate reimplementation of src/comparison/compare.py so the
 * reviewer can retune scope weights and adjustment values and watch the ranking
 * move immediately, with no server round trip.
 *
 * Two copies of the same arithmetic is a real risk: they can drift, and a
 * console that quietly disagrees with the pipeline is worse than no console at
 * all. `verifyAgainstPipeline` guards that. It re-levels using the defaults and
 * asserts the result matches the Python-computed totals that shipped in the
 * export. The parity badge in the UI is driven by that check, so drift shows up
 * as a visible failure rather than a number nobody questions.
 *
 * Python remains the source of truth. This mirrors it; it does not replace it.
 */

import type {
  AdjustmentRule,
  AppliedAdjustment,
  Importance,
  PipelineData,
  ScopeStatus,
  Submission,
  VendorComparison,
} from './types';

/** Reviewer-tunable settings, all defaulting to what the pipeline shipped. */
export interface LevelingSettings {
  /** Per scope item: how hard a gap counts. `ignored` removes it from leveling. */
  importance: Record<string, Importance>;
  /** Per scope item: the estimator-entered dollar value of the gap. */
  amounts: Record<string, number>;
  /** Whether an ambiguous item is priced as a gap. Off by default, and that is a policy, not an oversight. */
  priceUnclearScope: boolean;
}

/**
 * Multiplier applied to a gap's dollar value.
 *
 * This is the "importance grade" surfaced in settings. Critical scope is
 * carried at full value plus a risk premium because a bidder who missed it will
 * price the change order without competition; optional scope is discounted
 * because the estimator may well accept it as-is.
 */
export const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  critical: 1.25,
  standard: 1.0,
  optional: 0.5,
  ignored: 0,
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  critical: 'Critical',
  standard: 'Standard',
  optional: 'Optional',
  ignored: 'Not leveled',
};

/**
 * Defaults reproduce the Python baseline exactly.
 *
 * Every rule ships at `standard` (weight 1.0) so the console opens showing the
 * same numbers the pipeline produced. Anything else would mean the first thing
 * a reviewer sees disagrees with the committed test fixtures.
 */
export function defaultSettings(data: PipelineData): LevelingSettings {
  const importance: Record<string, Importance> = {};
  const amounts: Record<string, number> = {};

  for (const item of data.scope_items) {
    const rule = data.adjustment_rules.rules.find((r) => r.scope_key === item.key);
    // Scope with no estimator-entered value is not leveled: the platform can
    // flag a gap, but only a human assigns it a price.
    importance[item.key] = rule ? 'standard' : 'ignored';
    amounts[item.key] = rule ? rule.amount : 0;
  }

  return { importance, amounts, priceUnclearScope: false };
}

function triggersAdjustment(
  status: ScopeStatus,
  rule: AdjustmentRule | undefined,
  priceUnclearScope: boolean
): boolean {
  if (status === 'Unclear') return priceUnclearScope;
  if (!rule) return false;
  return rule.applies_when_status.includes(status);
}

export function computeAdjustments(
  data: PipelineData,
  submission: Submission,
  settings: LevelingSettings
): AppliedAdjustment[] {
  const applied: AppliedAdjustment[] = [];

  for (const item of data.scope_items) {
    // Scope carried by another bid package is never priced here; adding it
    // would double-count against that package's budget.
    if (!item.in_package_scope) continue;

    const grade = settings.importance[item.key] ?? 'ignored';
    if (grade === 'ignored') continue;

    const rule = data.adjustment_rules.rules.find((r) => r.scope_key === item.key);
    const status = submission.scope_assertions[item.key] ?? 'NotFound';
    if (!triggersAdjustment(status, rule, settings.priceUnclearScope)) continue;

    const base = settings.amounts[item.key] ?? 0;
    const amount = Math.round(base * IMPORTANCE_WEIGHT[grade] * 100) / 100;
    if (amount === 0) continue;

    applied.push({
      scope_key: item.key,
      label: item.label,
      status,
      amount,
      rationale: rule?.rationale ?? 'Estimator-entered adjustment.',
    });
  }

  return applied;
}

/**
 * Re-level every active bid.
 *
 * Superseded submissions are excluded before any ranking math runs: a reissued
 * proposal replaces its predecessor and must not appear twice in the averages.
 */
export function buildComparison(
  data: PipelineData,
  settings: LevelingSettings,
  overrides: Record<string, Partial<Submission>> = {}
): VendorComparison[] {
  const active = data.submissions.filter((s) => !s.superseded);

  const vendors: VendorComparison[] = active.map((submission) => {
    const patched: Submission = { ...submission, ...overrides[submission.bid_id] };
    const adjustments = computeAdjustments(data, patched, settings);
    const submitted = patched.base_bid;
    const adjusted =
      Math.round((submitted + adjustments.reduce((sum, a) => sum + a.amount, 0)) * 100) / 100;

    const unclear = data.scope_items
      .filter((item) => patched.scope_assertions[item.key] === 'Unclear')
      .map((item) => item.key);

    return {
      vendor_id: patched.vendor_id,
      vendor_name: patched.vendor_name,
      revision_label: patched.revision_label,
      submitted_total: submitted,
      adjusted_total: adjusted,
      submitted_rank: 0,
      adjusted_rank: 0,
      rank_movement: 0,
      leveling_delta: Math.round((adjusted - submitted) * 100) / 100,
      leveling_delta_pct:
        submitted === 0 ? 0 : Math.round(((adjusted - submitted) / submitted) * 10000) / 100,
      confidence_tier: patched.confidence_tier,
      unclear_scope_keys: unclear,
      adjustments,
    };
  });

  [...vendors]
    .sort((a, b) => a.submitted_total - b.submitted_total)
    .forEach((v, i) => {
      v.submitted_rank = i + 1;
    });
  [...vendors]
    .sort((a, b) => a.adjusted_total - b.adjusted_total)
    .forEach((v, i) => {
      v.adjusted_rank = i + 1;
    });
  vendors.forEach((v) => {
    v.rank_movement = v.submitted_rank - v.adjusted_rank;
  });

  return vendors;
}

export interface ParityResult {
  ok: boolean;
  checked: number;
  mismatches: { vendor: string; expected: number; actual: number }[];
}

/**
 * Prove the TypeScript engine still agrees with the Python one.
 *
 * Runs at default settings and compares against the totals the pipeline
 * exported. If someone edits this file and changes behaviour, the console says
 * so on screen instead of confidently showing wrong money.
 */
export function verifyAgainstPipeline(data: PipelineData): ParityResult {
  const computed = buildComparison(data, defaultSettings(data));
  const mismatches: ParityResult['mismatches'] = [];

  for (const expected of data.vendors) {
    const actual = computed.find((v) => v.vendor_id === expected.vendor_id);
    if (!actual || Math.abs(actual.adjusted_total - expected.adjusted_total) > 0.01) {
      mismatches.push({
        vendor: expected.vendor_name,
        expected: expected.adjusted_total,
        actual: actual?.adjusted_total ?? NaN,
      });
    }
  }

  return { ok: mismatches.length === 0, checked: data.vendors.length, mismatches };
}
