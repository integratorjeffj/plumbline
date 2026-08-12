/**
 * Client-side anomaly rules, mirroring src/comparison/anomalies.py.
 *
 * Recomputed whenever the reviewer changes scope weights, because a finding
 * that does not respond to the settings that produced it is decoration. Marking
 * the arc-flash study "not leveled" should visibly drop it out of the findings
 * list, so the reviewer sees the consequence of the call they just made.
 *
 * Every rule here is arithmetic or a set comparison. No model is involved, which
 * is what makes each finding reproducible and explainable line by line.
 */

import type { Finding, PipelineData, Severity, Submission, VendorComparison } from './types';
import type { LevelingSettings } from './leveling';
import { money, percent } from './format';

export const PRICING_OUTLIER_LOW_PCT = 10;
export const LARGE_LEVELING_DELTA_PCT = 15;
const ARITHMETIC_TOLERANCE = 0.01;

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, INFO: 2 };

function normalizeRevision(label: string): string {
  return label.toLowerCase().replace(/revision/g, 'rev').replace(/\s+/g, '');
}

export function computeFindings(
  data: PipelineData,
  vendors: VendorComparison[],
  settings: LevelingSettings
): Finding[] {
  const findings: Finding[] = [];
  const active = data.submissions.filter((s) => !s.superseded);
  const byId = new Map(vendors.map((v) => [v.vendor_id, v]));

  // --- stated total vs the vendor's own line items ---
  for (const s of active) {
    if (s.line_item_total === null) continue; // lump sum: nothing to reconcile
    const delta = Math.round((s.line_item_total - s.base_bid) * 100) / 100;
    if (Math.abs(delta) > ARITHMETIC_TOLERANCE) {
      findings.push({
        code: 'arithmetic_discrepancy',
        severity: 'HIGH',
        vendor_id: s.vendor_id,
        vendor_name: s.vendor_name,
        summary: `${s.vendor_name} states a base bid of ${money(s.base_bid, 2)} but its line items sum to ${money(s.line_item_total, 2)} (difference ${money(Math.abs(delta), 2)}).`,
        detail: { stated_total: s.base_bid, line_item_total: s.line_item_total, delta },
      });
    }
  }

  // --- proposals priced against a superseded drawing set ---
  for (const s of active) {
    if (!s.drawing_revision_referenced) {
      findings.push({
        code: 'drawing_revision_unstated',
        severity: 'MEDIUM',
        vendor_id: s.vendor_id,
        vendor_name: s.vendor_name,
        summary: `${s.vendor_name} does not state which drawing revision its pricing is based on.`,
        detail: { project_revision: data.project.drawing_revision },
      });
    } else if (
      normalizeRevision(s.drawing_revision_referenced) !==
      normalizeRevision(data.project.drawing_revision)
    ) {
      findings.push({
        code: 'stale_drawing_revision',
        severity: 'HIGH',
        vendor_id: s.vendor_id,
        vendor_name: s.vendor_name,
        summary: `${s.vendor_name} priced against drawings ${s.drawing_revision_referenced}, but the project is at ${data.project.drawing_revision}.`,
        detail: {
          referenced: s.drawing_revision_referenced,
          project_revision: data.project.drawing_revision,
        },
      });
    }
  }

  // --- specification scope that NO bidder covered ---
  // The finding a side-by-side price comparison structurally cannot produce: if
  // everyone omitted the same item, nothing in the bid set looks unusual.
  for (const req of data.required_scope) {
    if (settings.importance[req.scope_key] === 'ignored') continue;

    const statuses: Record<string, string> = {};
    for (const s of active) statuses[s.vendor_id] = s.scope_assertions[req.scope_key] ?? 'NotFound';
    if (Object.values(statuses).some((st) => st === 'Included')) continue;

    const item = data.scope_items.find((i) => i.key === req.scope_key);
    findings.push({
      code: 'required_scope_missing_all_bidders',
      severity: req.critical ? 'HIGH' : 'MEDIUM',
      vendor_id: null,
      vendor_name: null,
      summary: `${item?.label ?? req.scope_key} is required by specification section ${req.spec_section} but is not included by ANY bidder.`,
      detail: {
        scope_key: req.scope_key,
        spec_section: req.spec_section,
        spec_title: req.title,
        statuses_by_vendor: statuses,
      },
    });
  }

  // --- submitted price materially below the competitor median ---
  if (vendors.length >= 3) {
    const totals = vendors.map((v) => v.submitted_total).sort((a, b) => a - b);
    const mid = Math.floor(totals.length / 2);
    const median =
      totals.length % 2 === 0 ? (totals[mid - 1] + totals[mid]) / 2 : totals[mid];

    for (const v of vendors) {
      const pctBelow = ((median - v.submitted_total) / median) * 100;
      if (pctBelow > PRICING_OUTLIER_LOW_PCT) {
        findings.push({
          code: 'pricing_outlier_low',
          severity: 'MEDIUM',
          vendor_id: v.vendor_id,
          vendor_name: v.vendor_name,
          summary: `${v.vendor_name} is ${pctBelow.toFixed(1)}% below the median submitted price of ${money(median, 2)}.`,
          detail: { submitted_total: v.submitted_total, median, pct_below: pctBelow },
        });
      }
    }
  }

  // --- bids that move sharply once their gaps are priced ---
  for (const v of vendors) {
    if (v.leveling_delta_pct > LARGE_LEVELING_DELTA_PCT) {
      findings.push({
        code: 'large_leveling_delta',
        severity: 'HIGH',
        vendor_id: v.vendor_id,
        vendor_name: v.vendor_name,
        summary: `${v.vendor_name} rises ${percent(v.leveling_delta_pct)} (${money(v.leveling_delta, 2)}) once excluded scope is priced, from ${money(v.submitted_total, 2)} to ${money(v.adjusted_total, 2)}.`,
        detail: {
          submitted_total: v.submitted_total,
          adjusted_total: v.adjusted_total,
          delta_pct: v.leveling_delta_pct,
          adjustments: v.adjustments.map((a) => a.scope_key),
        },
      });
    }
  }

  // --- ambiguous scope: a clarification to send, not a cost to assume ---
  for (const s of active) {
    const unclear = data.scope_items.filter((i) => s.scope_assertions[i.key] === 'Unclear');
    if (unclear.length) {
      findings.push({
        code: 'unclear_scope_requires_clarification',
        severity: 'MEDIUM',
        vendor_id: s.vendor_id,
        vendor_name: s.vendor_name,
        summary: `${s.vendor_name} leaves ${unclear.length} scope item(s) ambiguous: ${unclear.map((i) => i.label).join(', ')}`,
        detail: { scope_keys: unclear.map((i) => i.key) },
      });
    }
  }

  // --- budget ---
  for (const v of vendors) {
    if (v.adjusted_total > data.project.budget) {
      const over = v.adjusted_total - data.project.budget;
      findings.push({
        code: 'adjusted_over_budget',
        severity: 'MEDIUM',
        vendor_id: v.vendor_id,
        vendor_name: v.vendor_name,
        summary: `${v.vendor_name} adjusted total ${money(v.adjusted_total, 2)} exceeds the ${money(data.project.budget, 2)} package budget by ${money(over, 2)}.`,
        detail: { adjusted_total: v.adjusted_total, budget: data.project.budget, over_by: over },
      });
    }
  }

  // --- superseded revisions, informational ---
  for (const sup of data.superseded) {
    findings.push({
      code: 'superseded_revision',
      severity: 'INFO',
      vendor_id: null,
      vendor_name: sup.vendor_name,
      summary: `${sup.vendor_name}: ${sup.note}. Comparison uses the latest revision.`,
      detail: { note: sup.note },
    });
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code)
  );
}

export function findingsForVendor(findings: Finding[], vendorId: string): Finding[] {
  return findings.filter((f) => f.vendor_id === vendorId);
}
