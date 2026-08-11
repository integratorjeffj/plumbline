"""Deterministic anomaly rules.

Every rule here is ordinary arithmetic or a set comparison -- no model involved.
That matters for two reasons: these findings are the ones an estimator will act
on, so they must be reproducible and explainable line by line; and separating
them from AI observations is an explicit charter requirement
(docs/charter.md Section 13: "separate deterministic validation failures from
AI-generated risk observations").

Thresholds are stated as named constants rather than buried literals so they can
be defended, tuned, and tested. A rule that does not fire on a given dataset is
still a rule that ran -- silence here is a result, not an omission.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from statistics import median

from src.comparison.compare import PackageComparison
from src.normalization.normalize import NormalizedBid
from src.normalization.taxonomy import label_for

# A bid this far below the median of its competitors is worth a second look.
PRICING_OUTLIER_LOW_PCT = 10.0
# A bid that grows this much once scope gaps are priced is materially incomplete.
LARGE_LEVELING_DELTA_PCT = 15.0
# Money is compared to the cent; anything larger is a real discrepancy.
ARITHMETIC_TOLERANCE = 0.01

SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_INFO = "INFO"


@dataclass
class Anomaly:
    code: str
    severity: str
    summary: str
    vendor_id: str | None = None
    vendor_name: str | None = None
    detail: dict = field(default_factory=dict)


def load_required_scope(path: Path) -> list[dict]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return raw["required_scope"]


def check_arithmetic(bids: list[NormalizedBid]) -> list[Anomaly]:
    """Stated total vs. the sum of the vendor's own line items."""
    anomalies = []
    for bid in bids:
        line_total = bid.line_item_total
        if line_total is None:
            continue  # Lump-sum bid; nothing to reconcile against.
        delta = round(line_total - bid.submitted_total, 2)
        if abs(delta) > ARITHMETIC_TOLERANCE:
            anomalies.append(Anomaly(
                code="arithmetic_discrepancy",
                severity=SEVERITY_HIGH,
                vendor_id=bid.vendor_id,
                vendor_name=bid.vendor_name,
                summary=(
                    f"{bid.vendor_name} states a base bid of ${bid.submitted_total:,.2f} but its "
                    f"line items sum to ${line_total:,.2f} (difference ${abs(delta):,.2f})."
                ),
                detail={
                    "stated_total": bid.submitted_total,
                    "line_item_total": line_total,
                    "delta": delta,
                },
            ))
    return anomalies


def check_drawing_revision(bids: list[NormalizedBid], current_revision: str) -> list[Anomaly]:
    """Proposals priced against a superseded drawing set."""
    def _normalize(label: str) -> str:
        return label.lower().replace("revision", "rev").replace(" ", "")

    anomalies = []
    target = _normalize(current_revision)
    for bid in bids:
        referenced = bid.drawing_revision_referenced
        if referenced is None:
            anomalies.append(Anomaly(
                code="drawing_revision_unstated",
                severity=SEVERITY_MEDIUM,
                vendor_id=bid.vendor_id,
                vendor_name=bid.vendor_name,
                summary=f"{bid.vendor_name} does not state which drawing revision its pricing is based on.",
                detail={"project_revision": current_revision},
            ))
        elif _normalize(referenced) != target:
            anomalies.append(Anomaly(
                code="stale_drawing_revision",
                severity=SEVERITY_HIGH,
                vendor_id=bid.vendor_id,
                vendor_name=bid.vendor_name,
                summary=(
                    f"{bid.vendor_name} priced against drawings {referenced}, but the project is "
                    f"at {current_revision}."
                ),
                detail={"referenced": referenced, "project_revision": current_revision},
            ))
    return anomalies


def check_required_scope_coverage(
    bids: list[NormalizedBid], required_scope: list[dict]
) -> list[Anomaly]:
    """Scope the specification requires that NO bidder covered.

    This is the finding a side-by-side price comparison structurally cannot
    produce: if every bidder omitted the same item, nothing in the bid set looks
    unusual, yet the whole package is underpriced against the specification.
    """
    anomalies = []
    for requirement in required_scope:
        scope_key = requirement["scope_key"]
        statuses = {bid.vendor_id: bid.status_for(scope_key) for bid in bids}
        if any(status == "Included" for status in statuses.values()):
            continue

        anomalies.append(Anomaly(
            code="required_scope_missing_all_bidders",
            severity=SEVERITY_HIGH if requirement.get("critical") else SEVERITY_MEDIUM,
            summary=(
                f"{label_for(scope_key)} is required by specification section "
                f"{requirement['spec_section']} but is not included by ANY bidder."
            ),
            detail={
                "scope_key": scope_key,
                "spec_section": requirement["spec_section"],
                "spec_title": requirement["title"],
                "statuses_by_vendor": statuses,
            },
        ))
    return anomalies


def check_pricing_outliers(comparison: PackageComparison) -> list[Anomaly]:
    """Submitted prices materially below the competitor median."""
    if len(comparison.vendors) < 3:
        return []

    totals = [v.submitted_total for v in comparison.vendors]
    median_total = median(totals)

    anomalies = []
    for vendor in comparison.vendors:
        pct_below = (median_total - vendor.submitted_total) / median_total * 100
        if pct_below > PRICING_OUTLIER_LOW_PCT:
            anomalies.append(Anomaly(
                code="pricing_outlier_low",
                severity=SEVERITY_MEDIUM,
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                summary=(
                    f"{vendor.vendor_name} is {pct_below:.1f}% below the median submitted price "
                    f"of ${median_total:,.2f}."
                ),
                detail={"submitted_total": vendor.submitted_total, "median": median_total,
                        "pct_below": round(pct_below, 2)},
            ))
    return anomalies


def check_leveling_deltas(comparison: PackageComparison) -> list[Anomaly]:
    """Bids that move sharply once their scope gaps are priced."""
    anomalies = []
    for vendor in comparison.vendors:
        if vendor.leveling_delta_pct > LARGE_LEVELING_DELTA_PCT:
            anomalies.append(Anomaly(
                code="large_leveling_delta",
                severity=SEVERITY_HIGH,
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                summary=(
                    f"{vendor.vendor_name} rises {vendor.leveling_delta_pct:.1f}% "
                    f"(${vendor.leveling_delta:,.2f}) once excluded scope is priced -- "
                    f"from ${vendor.submitted_total:,.2f} to ${vendor.adjusted_total:,.2f}."
                ),
                detail={
                    "submitted_total": vendor.submitted_total,
                    "adjusted_total": vendor.adjusted_total,
                    "delta_pct": vendor.leveling_delta_pct,
                    "adjustments": [a.scope_key for a in vendor.adjustments],
                },
            ))
    return anomalies


def check_unclear_scope(bids: list[NormalizedBid]) -> list[Anomaly]:
    """Ambiguous items -- these become clarification requests, not price assumptions."""
    anomalies = []
    for bid in bids:
        unclear = bid.unclear_scope_keys()
        if unclear:
            anomalies.append(Anomaly(
                code="unclear_scope_requires_clarification",
                severity=SEVERITY_MEDIUM,
                vendor_id=bid.vendor_id,
                vendor_name=bid.vendor_name,
                summary=(
                    f"{bid.vendor_name} leaves {len(unclear)} scope item(s) ambiguous: "
                    + ", ".join(label_for(k) for k in unclear)
                ),
                detail={"scope_keys": unclear},
            ))
    return anomalies


def check_superseded(comparison: PackageComparison) -> list[Anomaly]:
    anomalies = []
    for vendor_name, note in comparison.superseded:
        anomalies.append(Anomaly(
            code="superseded_revision",
            severity=SEVERITY_INFO,
            vendor_name=vendor_name,
            summary=f"{vendor_name}: {note}. Comparison uses the latest revision.",
            detail={"note": note},
        ))
    return anomalies


def check_budget(comparison: PackageComparison) -> list[Anomaly]:
    anomalies = []
    for vendor in comparison.vendors:
        if vendor.adjusted_total > comparison.budget:
            over = vendor.adjusted_total - comparison.budget
            anomalies.append(Anomaly(
                code="adjusted_over_budget",
                severity=SEVERITY_MEDIUM,
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                summary=(
                    f"{vendor.vendor_name} adjusted total ${vendor.adjusted_total:,.2f} exceeds the "
                    f"${comparison.budget:,.2f} package budget by ${over:,.2f}."
                ),
                detail={"adjusted_total": vendor.adjusted_total, "budget": comparison.budget,
                        "over_by": round(over, 2)},
            ))
    return anomalies


SEVERITY_ORDER = {SEVERITY_HIGH: 0, SEVERITY_MEDIUM: 1, SEVERITY_INFO: 2}


def run_all(
    comparison: PackageComparison,
    all_bids: list[NormalizedBid],
    required_scope: list[dict],
    current_drawing_revision: str,
) -> list[Anomaly]:
    """Run every rule and return findings sorted most severe first.

    Vendor-level rules run against ACTIVE bids only -- flagging a superseded
    proposal's arithmetic would be noise, since it is no longer in play.
    """
    active_bids = [bid for bid in all_bids if bid.is_active]

    anomalies: list[Anomaly] = []
    anomalies += check_arithmetic(active_bids)
    anomalies += check_drawing_revision(active_bids, current_drawing_revision)
    anomalies += check_required_scope_coverage(active_bids, required_scope)
    anomalies += check_pricing_outliers(comparison)
    anomalies += check_leveling_deltas(comparison)
    anomalies += check_unclear_scope(active_bids)
    anomalies += check_budget(comparison)
    anomalies += check_superseded(comparison)

    return sorted(anomalies, key=lambda a: (SEVERITY_ORDER[a.severity], a.code))
