"""Bid leveling and comparison.

Turns a set of normalized bids into the apples-to-apples comparison the whole
product exists to produce: a complete scope matrix, and each bidder's submitted
price alongside an adjusted price that accounts for what they left out.

All arithmetic here is deterministic. The AI's contribution ended at reading the
documents; ranking, summing, and comparing are ordinary code, which is what
makes the numbers reproducible and auditable
(docs/architecture-review.md Section 4).
"""

from dataclasses import dataclass, field

from src.comparison.adjustments import AdjustmentSet
from src.normalization.normalize import NormalizedBid
from src.normalization.taxonomy import (
    IN_PACKAGE_SCOPE_KEYS,
    SCOPE_BY_KEY,
    SCOPE_KEYS,
    label_for,
)


@dataclass
class AppliedAdjustment:
    scope_key: str
    label: str
    status: str
    amount: float
    rationale: str


@dataclass
class VendorComparison:
    vendor_id: str
    vendor_name: str
    revision_label: str
    submitted_total: float
    adjusted_total: float
    adjustments: list[AppliedAdjustment] = field(default_factory=list)
    unclear_scope_keys: list[str] = field(default_factory=list)
    confidence_tier: str = "REVIEW"
    submitted_rank: int = 0
    adjusted_rank: int = 0

    @property
    def leveling_delta(self) -> float:
        return round(self.adjusted_total - self.submitted_total, 2)

    @property
    def leveling_delta_pct(self) -> float:
        if self.submitted_total == 0:
            return 0.0
        return round(self.leveling_delta / self.submitted_total * 100, 2)

    @property
    def rank_movement(self) -> int:
        """Positive means leveling moved this bidder UP toward best value."""
        return self.submitted_rank - self.adjusted_rank


@dataclass
class PackageComparison:
    project_number: str
    bid_package_number: str
    budget: float
    vendors: list[VendorComparison]
    scope_matrix: dict[str, dict[str, str]]
    adjustments_entered_by: str
    out_of_package_scope_keys: list[str] = field(default_factory=list)
    anomalies: list = field(default_factory=list)
    revision_diffs: list = field(default_factory=list)
    superseded: list[tuple[str, str]] = field(default_factory=list)

    def by_submitted_rank(self) -> list[VendorComparison]:
        return sorted(self.vendors, key=lambda v: v.submitted_rank)

    def by_adjusted_rank(self) -> list[VendorComparison]:
        return sorted(self.vendors, key=lambda v: v.adjusted_rank)

    @property
    def lowest_submitted(self) -> VendorComparison:
        return self.by_submitted_rank()[0]

    @property
    def lowest_adjusted(self) -> VendorComparison:
        return self.by_adjusted_rank()[0]

    @property
    def leveling_changes_the_answer(self) -> bool:
        """True when the cheapest submitted bid is not the best value once leveled."""
        return self.lowest_submitted.vendor_id != self.lowest_adjusted.vendor_id


def compute_adjustments(bid: NormalizedBid, adjustment_set: AdjustmentSet) -> list[AppliedAdjustment]:
    """Apply estimator-entered adjustments for scope this bidder did not cover.

    Only in-package scope is ever priced. `Unclear` is deliberately not an
    adjustment trigger: an ambiguous item is a clarification to send the vendor,
    not a number to assume against them.
    """
    applied: list[AppliedAdjustment] = []
    for scope_key in IN_PACKAGE_SCOPE_KEYS:
        rule = adjustment_set.rule_for(scope_key)
        if rule is None:
            continue
        status = bid.status_for(scope_key)
        if status in rule.applies_when_status:
            applied.append(AppliedAdjustment(
                scope_key=scope_key,
                label=label_for(scope_key),
                status=status,
                amount=rule.amount,
                rationale=rule.rationale,
            ))
    return applied


def build_comparison(
    bids: list[NormalizedBid],
    adjustment_set: AdjustmentSet,
    project_number: str,
    bid_package_number: str,
    budget: float,
) -> PackageComparison:
    """Build the package comparison from the ACTIVE (non-superseded) bids."""
    active_bids = [bid for bid in bids if bid.is_active]
    if not active_bids:
        raise ValueError("Cannot build a comparison with no active bids")

    vendors: list[VendorComparison] = []
    for bid in active_bids:
        applied = compute_adjustments(bid, adjustment_set)
        vendors.append(VendorComparison(
            vendor_id=bid.vendor_id,
            vendor_name=bid.vendor_name,
            revision_label=bid.revision_label,
            submitted_total=bid.submitted_total,
            adjusted_total=round(bid.submitted_total + sum(a.amount for a in applied), 2),
            adjustments=applied,
            unclear_scope_keys=bid.unclear_scope_keys(),
            confidence_tier=bid.confidence_tier,
        ))

    for rank, vendor in enumerate(sorted(vendors, key=lambda v: v.submitted_total), start=1):
        vendor.submitted_rank = rank
    for rank, vendor in enumerate(sorted(vendors, key=lambda v: v.adjusted_total), start=1):
        vendor.adjusted_rank = rank

    scope_matrix = {
        scope_key: {bid.vendor_id: bid.status_for(scope_key) for bid in active_bids}
        for scope_key in SCOPE_KEYS
    }

    superseded = [
        (bid.vendor_name, f"{bid.revision_label} superseded by {bid.superseded_by}")
        for bid in bids
        if not bid.is_active
    ]

    return PackageComparison(
        project_number=project_number,
        bid_package_number=bid_package_number,
        budget=budget,
        vendors=vendors,
        scope_matrix=scope_matrix,
        adjustments_entered_by=adjustment_set.entered_by,
        out_of_package_scope_keys=[
            key for key in SCOPE_KEYS if not SCOPE_BY_KEY[key].in_package_scope
        ],
        superseded=superseded,
    )
