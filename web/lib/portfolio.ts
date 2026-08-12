/**
 * Portfolio-level rollup across every bid package.
 *
 * Deliberately recomputes through the same engine every per-package page
 * calls (defaultSettings / buildComparison / computeFindings) rather than
 * trusting each project's shipped `summary` block. That block was frozen at
 * build time by scripts/build-demo-projects.ts; recomputing here means the
 * portfolio view stays correct if the leveling or findings logic ever
 * changes, with nobody needing to remember to regenerate demo data.
 *
 * Every figure here is a pre-award number -- "leveled bid exposure" is the
 * sum of each package's lowest ADJUSTED bid, never "committed" or "paid."
 * Plumbline stops at a human approving an extraction; it has no post-award
 * tracking, and this module must not imply otherwise.
 */

import { PROJECT_IDS, getProject } from './projects';
import { defaultSettings, buildComparison } from './leveling';
import { computeFindings } from './findings';
import type { PipelineData } from './types';

export type RagLevel = 'green' | 'amber' | 'red';

// Exact thresholds -- no ambiguity for implementation or for a reader
// auditing why a dot is the color it is.
export const SCOPE_COVERAGE_AMBER_MAX = 1.0; // < 100% covered -> amber, unless red
export const SCOPE_COVERAGE_RED_MAX = 0.8; // < 80% covered -> red
export const COST_VARIANCE_AMBER_MAX_PCT = 10; // 0-10% over budget -> amber, else red
export const RISK_AMBER_MAX_HIGH = 2; // 1-2 HIGH findings -> amber, 3+ -> red

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  packageLabel: string;
  budget: number;
  lowestSubmittedTotal: number;
  lowestSubmittedVendor: string;
  lowestAdjustedTotal: number;
  lowestAdjustedVendor: string;
  /** budget - lowestAdjustedTotal; positive means under budget. */
  costVariance: number;
  costVariancePct: number;
  scopeCovered: number;
  scopeRequired: number;
  highFindingsCount: number;
  pendingReviewsDefault: number;
  scope: RagLevel;
  cost: RagLevel;
  risk: RagLevel;
  overall: RagLevel;
}

export interface PortfolioTotals {
  projects: ProjectHealth[];
  projectCount: number;
  totalBudget: number;
  totalBestValueExposure: number;
  totalVarianceToBudget: number;
  projectsOverBudgetCount: number;
  totalPendingReviewsDefault: number;
  totalHighFindings: number;
  ragTally: Record<'scope' | 'cost' | 'risk', Record<RagLevel, number>>;
}

function ragOrder(level: RagLevel): number {
  return level === 'red' ? 2 : level === 'amber' ? 1 : 0;
}

function worstOf(...levels: RagLevel[]): RagLevel {
  return levels.reduce((worst, level) => (ragOrder(level) > ragOrder(worst) ? level : worst), 'green' as RagLevel);
}

export function computeProjectHealth(projectId: string, data: PipelineData): ProjectHealth {
  const settings = defaultSettings(data);
  const vendors = buildComparison(data, settings);
  const findings = computeFindings(data, vendors, settings);

  const bySubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank)[0];
  const byAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank)[0];

  const requiredKeys = data.required_scope.map((r) => r.scope_key);
  const coveredKeys = requiredKeys.filter((key) => {
    const item = data.scope_items.find((si) => si.key === key);
    return item ? Object.values(item.statuses).some((s) => s === 'Included') : false;
  });
  const coverageFrac = requiredKeys.length === 0 ? 1 : coveredKeys.length / requiredKeys.length;

  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const variancePct = ((byAdjusted.adjusted_total - data.project.budget) / data.project.budget) * 100;

  const scope: RagLevel =
    coverageFrac < SCOPE_COVERAGE_RED_MAX ? 'red' : coverageFrac < SCOPE_COVERAGE_AMBER_MAX ? 'amber' : 'green';
  const cost: RagLevel =
    variancePct <= 0 ? 'green' : variancePct <= COST_VARIANCE_AMBER_MAX_PCT ? 'amber' : 'red';
  const risk: RagLevel = highCount === 0 ? 'green' : highCount <= RISK_AMBER_MAX_HIGH ? 'amber' : 'red';

  return {
    projectId,
    projectName: data.project.project_name,
    packageLabel: `${data.project.bid_package_number} · ${data.project.bid_package_description}`,
    budget: data.project.budget,
    lowestSubmittedTotal: bySubmitted.submitted_total,
    lowestSubmittedVendor: bySubmitted.vendor_name,
    lowestAdjustedTotal: byAdjusted.adjusted_total,
    lowestAdjustedVendor: byAdjusted.vendor_name,
    costVariance: data.project.budget - byAdjusted.adjusted_total,
    costVariancePct: variancePct,
    scopeCovered: coveredKeys.length,
    scopeRequired: requiredKeys.length,
    highFindingsCount: highCount,
    pendingReviewsDefault: data.submissions.filter((s) => !s.superseded).length,
    scope,
    cost,
    risk,
    overall: worstOf(scope, cost, risk),
  };
}

export function computePortfolioTotals(ids: string[] = PROJECT_IDS): PortfolioTotals {
  const projects = ids.map((id) => computeProjectHealth(id, getProject(id)!));

  const ragTally: PortfolioTotals['ragTally'] = {
    scope: { green: 0, amber: 0, red: 0 },
    cost: { green: 0, amber: 0, red: 0 },
    risk: { green: 0, amber: 0, red: 0 },
  };
  for (const p of projects) {
    ragTally.scope[p.scope]++;
    ragTally.cost[p.cost]++;
    ragTally.risk[p.risk]++;
  }

  return {
    projects,
    projectCount: projects.length,
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalBestValueExposure: projects.reduce((sum, p) => sum + p.lowestAdjustedTotal, 0),
    totalVarianceToBudget: projects.reduce((sum, p) => sum + p.costVariance, 0),
    projectsOverBudgetCount: projects.filter((p) => p.cost !== 'green').length,
    totalPendingReviewsDefault: projects.reduce((sum, p) => sum + p.pendingReviewsDefault, 0),
    totalHighFindings: projects.reduce((sum, p) => sum + p.highFindingsCount, 0),
    ragTally,
  };
}
