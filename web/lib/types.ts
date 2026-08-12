/**
 * Shapes of the pipeline export consumed by the console.
 *
 * These mirror scripts/export_demo_data.py. They are hand-written rather than
 * generated so the compiler fails loudly if the Python export drifts, instead
 * of the UI silently rendering `undefined` where a dollar figure belongs.
 */

export type ScopeStatus = 'Included' | 'Excluded' | 'Unclear' | 'NotFound';
export type ConfidenceTier = 'HIGH' | 'REVIEW' | 'LOW';
export type Severity = 'HIGH' | 'MEDIUM' | 'INFO';

/** How heavily a reviewer wants a scope gap to count against a bidder. */
export type Importance = 'critical' | 'standard' | 'optional' | 'ignored';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PageText {
  page_number: number;
  text: string;
}

export interface Citation {
  page: number;
  section: string;
}

export interface LineItem {
  description: string;
  amount: number;
}

export interface Allowance {
  name: string;
  amount: number;
  included_in_base_bid: boolean;
}

export interface Alternate {
  id: string;
  amount: number;
  included_in_base_bid: boolean;
}

export interface EmailEnvelope {
  subject: string;
  sender_name: string;
  sender_email: string;
  received_at: string;
  body_text: string;
  pricing_in_body: boolean;
}

export interface Submission {
  vendor_id: string;
  vendor_name: string;
  revision_label: string;
  filename: string;
  format: string;
  sha256: string;
  page_count: number;
  page_text: PageText[];
  email: EmailEnvelope;
  base_bid: number;
  line_items: LineItem[];
  line_item_count: number;
  line_item_total: number | null;
  scope_assertions: Record<string, ScopeStatus>;
  drawing_revision_referenced: string | null;
  confidence_tier: ConfidenceTier;
  provider: string;
  model: string;
  prompt_version: string;
  review_status: ReviewStatus;
  citations: Record<string, Citation>;
  allowances: Allowance[];
  alternates: Alternate[];
  bid_id: string;
  ai_inference_id: string;
  superseded: boolean;
}

export interface AppliedAdjustment {
  scope_key: string;
  label: string;
  status: string;
  amount: number;
  rationale: string;
}

export interface VendorComparison {
  vendor_id: string;
  vendor_name: string;
  revision_label: string;
  submitted_total: number;
  adjusted_total: number;
  submitted_rank: number;
  adjusted_rank: number;
  rank_movement: number;
  leveling_delta: number;
  leveling_delta_pct: number;
  confidence_tier: ConfidenceTier;
  unclear_scope_keys: string[];
  adjustments: AppliedAdjustment[];
}

export interface ScopeItem {
  key: string;
  label: string;
  in_package_scope: boolean;
  statuses: Record<string, ScopeStatus>;
}

export interface RequiredScope {
  scope_key: string;
  spec_section: string;
  title: string;
  critical: boolean;
}

export interface AdjustmentRule {
  scope_key: string;
  applies_when_status: ScopeStatus[];
  amount: number;
  rationale: string;
}

export interface AdjustmentRules {
  entered_by: string;
  entered_role: string;
  source: string;
  rules: AdjustmentRule[];
}

export interface Finding {
  code: string;
  severity: Severity;
  summary: string;
  vendor_id: string | null;
  vendor_name: string | null;
  detail: Record<string, unknown>;
}

export interface RevisionChange {
  label: string;
  previous: unknown;
  current: unknown;
  delta: number | null;
}

export interface Revision {
  vendor_id: string;
  vendor_name: string;
  previous_label: string;
  current_label: string;
  previous_total: number;
  current_total: number;
  total_delta: number;
  changes: RevisionChange[];
}

export interface ProjectInfo {
  project_number: string;
  project_name: string;
  customer: string;
  bid_package_number: string;
  bid_package_description: string;
  budget: number;
  drawing_revision: string;
  general_contractor: string;
  estimator: string;
}

export interface PipelineData {
  project: ProjectInfo;
  submissions: Submission[];
  vendors: VendorComparison[];
  scope_items: ScopeItem[];
  required_scope: RequiredScope[];
  adjustment_rules: AdjustmentRules;
  findings: Finding[];
  revisions: Revision[];
  superseded: { vendor_name: string; note: string }[];
  summary: {
    leveling_changes_the_answer: boolean;
    lowest_submitted: string;
    lowest_submitted_total: number;
    lowest_adjusted: string;
    lowest_adjusted_total: number;
    active_bidders: number;
    documents_processed: number;
    high_severity_findings: number;
  };
}
