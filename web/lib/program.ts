/**
 * Cross-package rollups.
 *
 * The program-level pages used to be empty states arguing that rolling up
 * across packages was unsafe. Two of those three arguments were real and one
 * was overstated, so they are answered here rather than repeated:
 *
 *   Findings   The objection was that two packages' severities have no defined
 *              ordering. They do not need one. Severity orders within a
 *              package, package identity is carried on every row, and the
 *              reader sorts and filters on whichever they care about. Nothing
 *              is silently interleaved.
 *
 *   Vendors    The objection was entity resolution: the same firm signs its
 *              proposals differently from one bid to the next, so merging on
 *              name could fuse two companies' histories. That risk is real in
 *              production and absent here, because identity is resolved at
 *              intake to a stable vendor_id (src/resolution/resolver.py) and no
 *              firm in this demo bids more than one package. The roster is
 *              therefore exact, and says so, rather than pretending the harder
 *              problem is solved.
 *
 *   Scope      The objection stands. Each package carries its own taxonomy, so
 *              a shared row would mean different things in different columns.
 *              What IS comparable is whether the scope a specification
 *              REQUIRES got covered, because that is anchored to a spec section
 *              rather than to a package's vocabulary. That is what rolls up.
 */

import { PROJECTS, PROJECT_IDS } from './projects';
import type {
  Finding,
  PipelineData,
  Severity,
  VendorPrequalification,
} from './types';

export const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, INFO: 2 };

export interface ProgramFinding extends Finding {
  projectId: string;
  projectName: string;
  packageLabel: string;
}

export interface ProgramVendor {
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  packageLabel: string;
  trade: string;
  submittedTotal: number;
  adjustedTotal: number;
  adjustedRank: number;
  bidderCount: number;
  awardScore: number | null;
  awardRank: number | null;
  prequal: VendorPrequalification | null;
}

export interface RequiredScopeRow {
  projectId: string;
  projectName: string;
  packageLabel: string;
  scopeKey: string;
  specSection: string;
  title: string;
  critical: boolean;
  /** Bidders who included it, out of those who bid the package. */
  includedBy: string[];
  bidderCount: number;
  covered: boolean;
}

function packageLabel(data: PipelineData): string {
  return `${data.project.bid_package_number} · ${data.project.bid_package_description}`;
}

export function allFindings(ids: string[] = PROJECT_IDS): ProgramFinding[] {
  const out: ProgramFinding[] = [];
  for (const projectId of ids) {
    const data = PROJECTS[projectId];
    if (!data) continue;
    for (const finding of data.findings) {
      out.push({
        ...finding,
        projectId,
        projectName: data.project.project_name,
        packageLabel: packageLabel(data),
      });
    }
  }
  return out.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.projectName.localeCompare(b.projectName) ||
      a.code.localeCompare(b.code)
  );
}

export function allVendors(ids: string[] = PROJECT_IDS): ProgramVendor[] {
  const out: ProgramVendor[] = [];
  for (const projectId of ids) {
    const data = PROJECTS[projectId];
    if (!data) continue;
    for (const vendor of data.vendors) {
      const score = data.award?.scores.find((s) => s.vendor_id === vendor.vendor_id) ?? null;
      out.push({
        vendorId: vendor.vendor_id,
        vendorName: vendor.vendor_name,
        projectId,
        projectName: data.project.project_name,
        packageLabel: packageLabel(data),
        trade: data.project.bid_package_description,
        submittedTotal: vendor.submitted_total,
        adjustedTotal: vendor.adjusted_total,
        adjustedRank: vendor.adjusted_rank,
        bidderCount: data.vendors.length,
        awardScore: score ? score.total_score : null,
        awardRank: score ? score.rank : null,
        prequal: data.prequalification?.[vendor.vendor_id] ?? null,
      });
    }
  }
  return out.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

/**
 * Whether a firm appears on more than one package.
 *
 * Zero everywhere in this demo. Surfaced anyway, because the moment it stops
 * being zero the roster needs real entity resolution behind it and the page
 * should say so rather than quietly merging rows.
 */
export function vendorsBiddingMultiplePackages(vendors: ProgramVendor[]): string[] {
  const seen = new Map<string, Set<string>>();
  for (const vendor of vendors) {
    const packages = seen.get(vendor.vendorId) ?? new Set<string>();
    packages.add(vendor.projectId);
    seen.set(vendor.vendorId, packages);
  }
  return [...seen.entries()].filter(([, packages]) => packages.size > 1).map(([id]) => id);
}

export function requiredScopeRows(ids: string[] = PROJECT_IDS): RequiredScopeRow[] {
  const out: RequiredScopeRow[] = [];
  for (const projectId of ids) {
    const data = PROJECTS[projectId];
    if (!data) continue;
    for (const requirement of data.required_scope) {
      const item = data.scope_items.find((s) => s.key === requirement.scope_key);
      const includedBy = item
        ? Object.entries(item.statuses)
            .filter(([, status]) => status === 'Included')
            .map(([vendorId]) => {
              const vendor = data.vendors.find((v) => v.vendor_id === vendorId);
              return vendor ? vendor.vendor_name : vendorId;
            })
        : [];
      out.push({
        projectId,
        projectName: data.project.project_name,
        packageLabel: packageLabel(data),
        scopeKey: requirement.scope_key,
        specSection: requirement.spec_section,
        title: requirement.title,
        critical: requirement.critical,
        includedBy,
        bidderCount: data.vendors.length,
        covered: includedBy.length > 0,
      });
    }
  }
  return out.sort(
    (a, b) =>
      Number(a.covered) - Number(b.covered) ||
      Number(b.critical) - Number(a.critical) ||
      a.projectName.localeCompare(b.projectName)
  );
}

export function severityTally(findings: ProgramFinding[]): Record<Severity, number> {
  const tally: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, INFO: 0 };
  for (const finding of findings) tally[finding.severity] += 1;
  return tally;
}
