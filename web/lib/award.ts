/**
 * Client-side award scoring.
 *
 * A deliberate reimplementation of src/comparison/award.py, for the same reason
 * ./leveling.ts mirrors compare.py: the reviewer needs to drag a weight and
 * watch the ranking move, and a server round trip per drag would make the
 * control feel like a form rather than a model.
 *
 * The same risk applies too. Two copies of a scoring rule can drift, and a
 * console that quietly disagrees with the pipeline is worse than no console.
 * `verifyAgainstPipeline` re-scores at the exported default weights and asserts
 * every total matches what Python computed, so drift surfaces as a visible
 * parity failure rather than a plausible-looking number.
 *
 * Python remains the source of truth. This mirrors it; it does not replace it.
 *
 * One subtlety worth stating, because it drifted once already: every factor
 * score is rounded to two decimals BEFORE it is multiplied by its weight, which
 * is what src/comparison/award.py does (FactorScore.weighted reads the rounded
 * `self.score`). Weighting the raw score instead differs by a cent whenever the
 * raw value sits near a rounding boundary, and a cent is enough to move a total.
 */

import type {
  AwardFactor,
  AwardRecommendation,
  AwardWeights,
  FactorScore,
  PipelineData,
  VendorComparison,
  VendorPrequalification,
  VendorScore,
} from './types';

export const DEFAULT_WEIGHTS: AwardWeights = {
  cost: 40,
  experience: 30,
  safety: 20,
  schedule: 10,
};

export const FACTOR_ORDER: AwardFactor[] = ['cost', 'experience', 'safety', 'schedule'];

export const FACTOR_LABELS: Record<AwardFactor, string> = {
  cost: 'Leveled cost',
  experience: 'Experience and past performance',
  safety: 'Safety record',
  schedule: 'Schedule and capacity',
};

/** Short forms for tight columns, where the full label will not fit. */
export const FACTOR_SHORT: Record<AwardFactor, string> = {
  cost: 'Cost',
  experience: 'Experience',
  safety: 'Safety',
  schedule: 'Schedule',
};

const EXPERIENCE_SUBWEIGHTS = {
  change_orders: 0.4,
  closeout: 0.3,
  depth: 0.2,
  relationship: 0.1,
};

const CHANGE_ORDER_PENALTY_PER_PCT = 10;
const BENCHMARK_COMPLETED_PACKAGES = 6;
const BENCHMARK_RELATIONSHIP_YEARS = 8;

const SCHEDULE_SUBWEIGHTS = { duration: 0.5, mobilization: 0.3, crew: 0.2 };
const DURATION_PENALTY_PER_WEEK = 15;
const MOBILIZATION_PENALTY_PER_WEEK = 20;

const clamp = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

const money = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US')}`;

/**
 * Express any positive weights as percentages summing to 100.
 *
 * Four sliders will not land on exactly 100, and refusing to score until they
 * do would make the control useless. Proportions are what the model needs.
 */
export function normalizeWeights(weights: AwardWeights): AwardWeights {
  const total = FACTOR_ORDER.reduce((sum, factor) => sum + Math.max(0, weights[factor]), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };

  return FACTOR_ORDER.reduce((acc, factor) => {
    acc[factor] = Math.round((Math.max(0, weights[factor]) / total) * 100 * 10000) / 10000;
    return acc;
  }, {} as AwardWeights);
}

function scoreCost(adjustedTotal: number, bestTotal: number, weight: number): FactorScore {
  const score = adjustedTotal ? clamp((bestTotal / adjustedTotal) * 100) : 0;
  const premium = adjustedTotal - bestTotal;

  const rounded = round2(score);
  return {
    factor: 'cost',
    label: FACTOR_LABELS.cost,
    score: rounded,
    weight,
    weighted: round2((rounded * weight) / 100),
    basis:
      premium > 0
        ? `${money(adjustedTotal)} leveled, ${money(premium)} above the lowest leveled bid`
        : `${money(adjustedTotal)} leveled, the lowest leveled bid`,
    detail: { adjusted_total: adjustedTotal, best_total: bestTotal, premium_over_best: round2(premium) },
  };
}

function scoreSafety(
  prequal: VendorPrequalification,
  policy: { emr_high_risk_maximum: number; emr_disqualifying: number },
  weight: number
): FactorScore {
  const { emr } = prequal;
  const best = policy.emr_high_risk_maximum;
  const worst = policy.emr_disqualifying;
  const score = clamp(((worst - emr) / (worst - best)) * 100);

  const rounded = round2(score);
  return {
    factor: 'safety',
    label: FACTOR_LABELS.safety,
    score: rounded,
    weight,
    weighted: round2((rounded * weight) / 100),
    basis: `EMR ${emr.toFixed(2)} on a scale where ${best.toFixed(2)} scores 100 and ${worst.toFixed(2)} scores 0`,
    detail: { emr, best, worst, trir: prequal.safety.trir },
  };
}

function scoreExperience(prequal: VendorPrequalification, weight: number): FactorScore {
  const perf = prequal.performance;
  const parts = {
    change_orders: clamp(100 - perf.change_order_rate_pct * CHANGE_ORDER_PENALTY_PER_PCT),
    closeout: clamp(perf.on_time_closeout_pct),
    depth: clamp((perf.packages_completed / BENCHMARK_COMPLETED_PACKAGES) * 100),
    relationship: clamp((perf.years_working_together / BENCHMARK_RELATIONSHIP_YEARS) * 100),
  };
  const score = (Object.keys(parts) as (keyof typeof parts)[]).reduce(
    (sum, key) => sum + parts[key] * EXPERIENCE_SUBWEIGHTS[key],
    0
  );

  const rounded = round2(score);
  return {
    factor: 'experience',
    label: FACTOR_LABELS.experience,
    score: rounded,
    weight,
    weighted: round2((rounded * weight) / 100),
    basis:
      `${perf.change_order_rate_pct.toFixed(1)}% change-order rate, ` +
      `${perf.on_time_closeout_pct.toFixed(0)}% on-time closeout, ` +
      `${perf.packages_completed} package(s) completed over ${perf.years_working_together} years`,
    detail: { components: parts, subweights: EXPERIENCE_SUBWEIGHTS },
  };
}

function scoreSchedule(
  prequal: VendorPrequalification,
  requirement: { required_duration_weeks: number; max_mobilization_weeks: number; min_crew_size: number },
  weight: number
): FactorScore {
  const sched = prequal.schedule;
  const weeksOver = Math.max(0, sched.proposed_duration_weeks - requirement.required_duration_weeks);
  const mobilizationOver = Math.max(
    0,
    sched.mobilization_weeks - requirement.max_mobilization_weeks
  );

  const parts = {
    duration: clamp(100 - weeksOver * DURATION_PENALTY_PER_WEEK),
    mobilization: clamp(100 - mobilizationOver * MOBILIZATION_PENALTY_PER_WEEK),
    crew: requirement.min_crew_size
      ? clamp((sched.crew_size_committed / requirement.min_crew_size) * 100)
      : 100,
  };
  const score = (Object.keys(parts) as (keyof typeof parts)[]).reduce(
    (sum, key) => sum + parts[key] * SCHEDULE_SUBWEIGHTS[key],
    0
  );

  const rounded = round2(score);
  return {
    factor: 'schedule',
    label: FACTOR_LABELS.schedule,
    score: rounded,
    weight,
    weighted: round2((rounded * weight) / 100),
    basis: weeksOver
      ? `${sched.proposed_duration_weeks} weeks against a ${requirement.required_duration_weeks}-week requirement (${weeksOver} over), ${sched.crew_size_committed}-person crew`
      : `${sched.proposed_duration_weeks} weeks inside the ${requirement.required_duration_weeks}-week requirement, ${sched.crew_size_committed}-person crew`,
    detail: { components: parts, subweights: SCHEDULE_SUBWEIGHTS, weeks_over: weeksOver },
  };
}

function buildNarrative(
  recommendation: AwardRecommendation,
  vendors: VendorComparison[]
): string {
  const winner = recommendation.scores.find(
    (s) => s.vendor_id === recommendation.recommended_vendor_id
  );
  if (!winner) {
    return (
      'No bidder in this package clears prequalification, so there is no award recommendation ' +
      'to make. Every submission is blocked by at least one gate; the package needs additional ' +
      'bidders or a documented policy exception.'
    );
  }

  const runnerUp = recommendation.scores.find(
    (s) => s.vendor_id === recommendation.runner_up_vendor_id
  );
  const lines: string[] = [];

  let lead = `Recommend award to ${winner.vendor_name} at ${money(winner.adjusted_total)} leveled, scoring ${winner.total_score.toFixed(1)} of 100`;
  lead += runnerUp
    ? `, ahead of ${runnerUp.vendor_name} at ${runnerUp.total_score.toFixed(1)} (${recommendation.margin.toFixed(1)} points).`
    : ', the only bidder clearing prequalification.';
  lines.push(lead);

  const lowestSubmitted = [...vendors].sort((a, b) => a.submitted_total - b.submitted_total)[0];
  if (recommendation.agrees_with_lowest_leveled) {
    lines.push(
      lowestSubmitted.vendor_id !== winner.vendor_id
        ? `This is also the lowest leveled bid. It is not the lowest submitted bid: ${lowestSubmitted.vendor_name} submitted ${money(lowestSubmitted.submitted_total)} but rises to ${money(lowestSubmitted.adjusted_total)} once excluded scope is priced.`
        : 'This is both the lowest submitted and the lowest leveled bid.'
    );
  } else {
    const eligible = recommendation.scores.filter((s) => s.eligible);
    const cheapest = [...eligible].sort((a, b) => a.adjusted_total - b.adjusted_total)[0];
    lines.push(
      `This is not the cheapest eligible bid. ${cheapest.vendor_name} is ${money(winner.adjusted_total - cheapest.adjusted_total)} lower leveled, and the weighted model still prefers ${winner.vendor_name} on non-price factors.`
    );
  }

  const ranked = [...winner.factors].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  lines.push(
    `Strongest factor is ${best.label.toLowerCase()} at ${best.score.toFixed(0)} of 100 (${best.basis}); weakest is ${worst.label.toLowerCase()} at ${worst.score.toFixed(0)} (${worst.basis}).`
  );

  const excluded = recommendation.scores.filter((s) => !s.eligible);
  if (excluded.length) {
    const parts = [...excluded]
      .sort((a, b) => a.adjusted_total - b.adjusted_total)
      .map((s) => {
        const delta = s.adjusted_total - winner.adjusted_total;
        const position = `${money(Math.abs(delta))} ${delta < 0 ? 'below' : 'above'} the recommendation`;
        return `${s.vendor_name} (${position}) -- ${s.disqualifying_reason}`;
      });
    lines.push(`${excluded.length} bidder(s) were excluded before scoring: ${parts.join(' ')}`);
  }

  lines.push(
    'Weights applied: ' +
      FACTOR_ORDER.map(
        (f) => `${FACTOR_LABELS[f].toLowerCase()} ${recommendation.weights[f].toFixed(0)}%`
      ).join(', ') +
      '.'
  );

  return lines.join(' ');
}

/**
 * Score every bidder, rank the eligible ones, and explain the result.
 *
 * Gated bidders are scored but never ranked. The estimator should be able to
 * see exactly what a gate cost -- especially when the excluded bidder was
 * cheaper -- without that number ever becoming a selectable option.
 */
export function buildAward(
  data: PipelineData,
  vendors: VendorComparison[],
  weights: AwardWeights
): AwardRecommendation | null {
  const prequalification = data.prequalification;
  const policy = data.policy;
  if (!prequalification || !policy || vendors.length === 0) return null;

  const resolved = normalizeWeights(weights);
  const bestTotal = Math.min(...vendors.map((v) => v.adjusted_total));

  const scores: VendorScore[] = vendors.map((vendor) => {
    const prequal = prequalification[vendor.vendor_id];
    if (!prequal) {
      const factors = [scoreCost(vendor.adjusted_total, bestTotal, resolved.cost)];
      return {
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_name,
        adjusted_total: vendor.adjusted_total,
        submitted_total: vendor.submitted_total,
        total_score: round2(factors.reduce((sum, f) => sum + f.weighted, 0)),
        eligible: false,
        disqualifying_reason: 'No prequalification record on file.',
        rank: null,
        factors,
      };
    }

    const factors = [
      scoreCost(vendor.adjusted_total, bestTotal, resolved.cost),
      scoreExperience(prequal, resolved.experience),
      scoreSafety(prequal, policy.prequalification, resolved.safety),
      scoreSchedule(prequal, policy.schedule_requirement, resolved.schedule),
    ];

    return {
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      adjusted_total: vendor.adjusted_total,
      submitted_total: vendor.submitted_total,
      total_score: round2(factors.reduce((sum, f) => sum + f.weighted, 0)),
      eligible: prequal.eligible,
      disqualifying_reason: prequal.disqualifying_reason,
      rank: null,
      factors,
    };
  });

  // Ties break on the lower leveled total -- the tiebreak an estimator would
  // defend in a bid-review meeting.
  const eligible = scores
    .filter((s) => s.eligible)
    .sort((a, b) => b.total_score - a.total_score || a.adjusted_total - b.adjusted_total);
  eligible.forEach((score, index) => {
    score.rank = index + 1;
  });

  const lowestLeveled = [...vendors].sort((a, b) => a.adjusted_total - b.adjusted_total)[0];
  const recommendation: AwardRecommendation = {
    weights: resolved,
    scores,
    recommended_vendor_id: eligible[0]?.vendor_id ?? null,
    runner_up_vendor_id: eligible[1]?.vendor_id ?? null,
    margin: eligible.length > 1 ? round2(eligible[0].total_score - eligible[1].total_score) : 0,
    agrees_with_lowest_leveled: eligible[0]?.vendor_id === lowestLeveled.vendor_id,
    narrative: '',
  };
  recommendation.narrative = buildNarrative(recommendation, vendors);

  return recommendation;
}

export interface AwardParityResult {
  ok: boolean;
  checked: number;
  mismatches: { vendor: string; expected: number; actual: number }[];
}

/**
 * Prove the TypeScript scoring still agrees with the Python engine.
 *
 * Scores at the exported default weights and compares every total against what
 * the pipeline computed. Returns `ok` with nothing checked when the package
 * carries no award baseline, so packages without prequalification records do
 * not read as parity failures.
 */
export function verifyAwardAgainstPipeline(
  data: PipelineData,
  vendors: VendorComparison[]
): AwardParityResult {
  const baseline = data.award;
  if (!baseline) return { ok: true, checked: 0, mismatches: [] };

  const computed = buildAward(data, vendors, baseline.weights);
  const mismatches: AwardParityResult['mismatches'] = [];

  for (const expected of baseline.scores) {
    const actual = computed?.scores.find((s) => s.vendor_id === expected.vendor_id);
    if (!actual || Math.abs(actual.total_score - expected.total_score) > 0.01) {
      mismatches.push({
        vendor: expected.vendor_name,
        expected: expected.total_score,
        actual: actual?.total_score ?? NaN,
      });
    }
  }

  return { ok: mismatches.length === 0, checked: baseline.scores.length, mismatches };
}
