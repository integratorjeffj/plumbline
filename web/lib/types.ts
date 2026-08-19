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

/** Prequalification gate outcomes. `fail` removes a bidder from award consideration. */
export type GateStatus = 'pass' | 'warn' | 'fail';

export interface PrequalGate {
  code: string;
  label: string;
  status: GateStatus;
  summary: string;
  detail: Record<string, unknown>;
}

export interface VendorPrequalification {
  vendor_id: string;
  vendor_name: string;
  eligible: boolean;
  status: GateStatus;
  disqualifying_reason: string | null;
  emr: number;
  last_reviewed: string;
  bond_utilization_pct: number;
  participation_certifications: string[];
  gates: PrequalGate[];
  safety: {
    emr: number;
    emr_year: number;
    trir: number;
    osha_recordables_3yr: number;
    lost_time_incidents_3yr: number;
  };
  bonding: {
    surety: string;
    am_best_rating: string;
    single_project_limit: number;
    aggregate_limit: number;
    current_backlog: number;
  };
  insurance: Record<string, number | string>;
  certifications: {
    dbe: boolean;
    mbe: boolean;
    wbe: boolean;
    sbe: boolean;
    certifying_agency: string | null;
  };
  performance: {
    packages_bid: number;
    packages_awarded: number;
    packages_completed: number;
    change_order_rate_pct: number;
    on_time_closeout_pct: number;
    avg_rfi_per_package: number;
    years_working_together: number;
  };
  schedule: {
    proposed_duration_weeks: number;
    mobilization_weeks: number;
    crew_size_committed: number;
    concurrent_awarded_packages: number;
  };
}

export type InvitationStatus = 'responded' | 'declined' | 'no_response';
export type CoverageHealth = 'healthy' | 'thin' | 'insufficient';

export interface Invitation {
  vendor_id: string;
  vendor_name: string;
  invited_at: string;
  status: InvitationStatus;
  note: string | null;
}

export interface AddendumAcknowledgment {
  vendor_id: string;
  vendor_name: string;
  drawing_revision_referenced: string | null;
  acknowledged_through: number | null;
  missing_addenda: number[];
  acknowledged: boolean;
  unstated: boolean;
}

export interface Addendum {
  number: number;
  issued_date: string;
  drawing_revision: string;
  description: string;
}

export interface PackageCoverage {
  issued_date: string;
  bids_due: string;
  invited_count: number;
  responded_count: number;
  declined_count: number;
  no_response_count: number;
  response_rate_pct: number;
  health: CoverageHealth;
  minimum_bidders: number;
  target_bidders: number;
  current_addendum: number;
  invitations: Invitation[];
  acknowledgments: AddendumAcknowledgment[];
  addenda: Addendum[];
}

/** The four factors the award model weighs. */
export type AwardFactor = 'cost' | 'experience' | 'safety' | 'schedule';

export type AwardWeights = Record<AwardFactor, number>;

export interface FactorScore {
  factor: AwardFactor;
  label: string;
  score: number;
  weight: number;
  weighted: number;
  basis: string;
  detail: Record<string, unknown>;
}

export interface VendorScore {
  vendor_id: string;
  vendor_name: string;
  adjusted_total: number;
  submitted_total: number;
  total_score: number;
  eligible: boolean;
  disqualifying_reason: string | null;
  rank: number | null;
  factors: FactorScore[];
}

export interface AwardRecommendation {
  weights: AwardWeights;
  scores: VendorScore[];
  recommended_vendor_id: string | null;
  runner_up_vendor_id: string | null;
  margin: number;
  agrees_with_lowest_leveled: boolean;
  narrative: string;
}

export interface PrequalPolicy {
  policy_owner: string;
  effective_date: string;
  review_cycle_months: number;
  emr_maximum: number;
  emr_high_risk_maximum: number;
  emr_disqualifying: number;
  single_project_bond_headroom_pct: number;
  aggregate_backlog_utilization_max_pct: number;
  insurance_minimums_usd: Record<string, number>;
  certificate_expiry_warning_days: number;
  policy_note: string;
}

export interface ScheduleRequirement {
  required_duration_weeks: number;
  max_mobilization_weeks: number;
  min_crew_size: number;
  notice_to_proceed: string;
}

export interface PackagePolicy {
  prequalification: PrequalPolicy;
  coverage: {
    minimum_bidders_per_package: number;
    target_bidders_per_package: number;
    minimum_response_rate_pct: number;
    policy_note: string;
  };
  schedule_requirement: ScheduleRequirement;
  evaluation_date: string;
}

export interface PipelineData {
  project: ProjectInfo;
  submissions: Submission[];
  vendors: VendorComparison[];
  scope_items: ScopeItem[];
  required_scope: RequiredScope[];
  /**
   * Eligibility and award reasoning. Optional on purpose: a hand-authored
   * package that carries no invitation log or prequalification records still
   * levels and compares, and the console degrades to an honest empty state
   * rather than inventing a gate result it has no evidence for.
   */
  prequalification?: Record<string, VendorPrequalification>;
  coverage?: PackageCoverage | null;
  award?: AwardRecommendation | null;
  policy?: PackagePolicy;
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
