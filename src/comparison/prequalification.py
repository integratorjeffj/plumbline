"""Subcontractor prequalification gates.

Leveling answers "what does this bid actually cost". It cannot answer "may we
carry this subcontractor at all", and those are different questions decided by
different evidence. A bidder can be the cheapest leveled number on the table and
still be ineligible because their experience modification rate is above the
threshold the GC's insurer will accept, or because their umbrella policy is
short of the limit the owner's contract requires.

So the gates here are deliberately NOT weights in a score. A score lets a low
price buy back a safety record, which is exactly the trade the policy exists to
forbid (sample-data/company/crestmark.json, policy_note). A failing gate removes
the bidder from award consideration; the weighted model in award.py then ranks
whoever is left.

Everything is evaluated as of a stated date rather than "now". A certificate
expiring next month has to read the same in a test run today as in a test run a
year from now, otherwise the golden fixtures rot on the calendar.
"""

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

# Gate outcomes, worst first. `fail` removes a bidder from award consideration;
# `warn` is a condition to resolve before subcontract, not a disqualification.
GATE_FAIL = "fail"
GATE_WARN = "warn"
GATE_PASS = "pass"

_GATE_ORDER = {GATE_FAIL: 0, GATE_WARN: 1, GATE_PASS: 2}

INSURANCE_LABELS = {
    "general_liability_occurrence": "General liability, per occurrence",
    "general_liability_aggregate": "General liability, aggregate",
    "auto_liability": "Automobile liability",
    "umbrella": "Umbrella / excess liability",
    "workers_comp_employers_liability": "Workers' compensation, employer's liability",
}


@dataclass
class Gate:
    """One prequalification check against one subcontractor."""

    code: str
    label: str
    status: str
    summary: str
    detail: dict = field(default_factory=dict)

    @property
    def failed(self) -> bool:
        return self.status == GATE_FAIL

    @property
    def warned(self) -> bool:
        return self.status == GATE_WARN


@dataclass
class VendorPrequalification:
    vendor_id: str
    vendor_name: str
    gates: list[Gate]
    emr: float
    last_reviewed: str
    safety: dict
    certifications: dict
    bonding: dict
    insurance: dict
    performance: dict
    schedule: dict

    @property
    def safety_trir(self) -> float | None:
        return self.safety.get("trir")

    @property
    def lost_time_incidents(self) -> int | None:
        return self.safety.get("lost_time_incidents_3yr")

    @property
    def failing_gates(self) -> list[Gate]:
        return [g for g in self.gates if g.failed]

    @property
    def warning_gates(self) -> list[Gate]:
        return [g for g in self.gates if g.warned]

    @property
    def eligible(self) -> bool:
        """Eligible for award. A warning does not remove a bidder; a failure does."""
        return not self.failing_gates

    @property
    def status(self) -> str:
        """Worst gate outcome, for a single badge in the UI."""
        return min((g.status for g in self.gates), key=lambda s: _GATE_ORDER[s], default=GATE_PASS)

    @property
    def disqualifying_reason(self) -> str | None:
        if not self.failing_gates:
            return None
        return "; ".join(g.summary for g in self.failing_gates)

    @property
    def bond_utilization_pct(self) -> float:
        aggregate = self.bonding.get("aggregate_limit", 0)
        if not aggregate:
            return 0.0
        return round(self.bonding.get("current_backlog", 0) / aggregate * 100, 1)

    @property
    def participation_certifications(self) -> list[str]:
        """DBE/MBE/WBE/SBE designations this firm actually carries."""
        return [
            name.upper()
            for name in ("dbe", "mbe", "wbe", "sbe")
            if self.certifications.get(name)
        ]


def load_policy(company_path: Path) -> dict:
    raw = json.loads(Path(company_path).read_text(encoding="utf-8"))
    return raw["subcontractor_prequalification_policy"]


def load_vendor_records(vendors_dir: Path) -> dict[str, dict]:
    """Vendor files keyed by vendor_id, for those carrying a prequal record."""
    records = {}
    for path in sorted(Path(vendors_dir).glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        if "prequalification" in raw:
            records[raw["vendor_id"]] = raw
    return records


def _months_between(earlier: date, later: date) -> int:
    return (later.year - earlier.year) * 12 + (later.month - earlier.month)


def _check_emr(safety: dict, policy: dict) -> Gate:
    """Experience modification rate against the GC's hard ceiling.

    Three bands, not two: at or under the high-risk maximum a bidder is clear for
    any package; between that and the standard maximum they are clear for this
    one but would not be for high-risk work; above the standard maximum they are
    out. The disqualifying threshold is carried in the detail so the UI can show
    how much room is left before a firm stops being prequalifiable at all.
    """
    emr = safety["emr"]
    standard_max = policy["emr_maximum"]
    high_risk_max = policy["emr_high_risk_maximum"]
    disqualifying = policy["emr_disqualifying"]

    detail = {
        "emr": emr,
        "emr_year": safety.get("emr_year"),
        "maximum": standard_max,
        "high_risk_maximum": high_risk_max,
        "disqualifying": disqualifying,
        "trir": safety.get("trir"),
        "lost_time_incidents_3yr": safety.get("lost_time_incidents_3yr"),
    }

    if emr > standard_max:
        beyond = "and is past the disqualifying threshold" if emr >= disqualifying else ""
        return Gate(
            code="emr_above_maximum",
            label="Experience modification rate",
            status=GATE_FAIL,
            summary=(
                f"EMR of {emr:.2f} ({safety.get('emr_year')}) exceeds the {standard_max:.2f} "
                f"maximum {beyond}".strip() + "."
            ),
            detail=detail,
        )

    if emr > high_risk_max:
        return Gate(
            code="emr_above_high_risk_maximum",
            label="Experience modification rate",
            status=GATE_WARN,
            summary=(
                f"EMR of {emr:.2f} clears the {standard_max:.2f} maximum for this package but "
                f"exceeds the {high_risk_max:.2f} ceiling used on high-risk work."
            ),
            detail=detail,
        )

    return Gate(
        code="emr_within_policy",
        label="Experience modification rate",
        status=GATE_PASS,
        summary=f"EMR of {emr:.2f} is within the {high_risk_max:.2f} high-risk ceiling.",
        detail=detail,
    )


def _check_insurance_limits(insurance: dict, policy: dict) -> Gate:
    minimums = policy["insurance_minimums_usd"]
    shortfalls = []
    for coverage, required in minimums.items():
        carried = insurance.get(coverage, 0)
        if carried < required:
            shortfalls.append({
                "coverage": coverage,
                "label": INSURANCE_LABELS.get(coverage, coverage),
                "carried": carried,
                "required": required,
                "short_by": required - carried,
            })

    if shortfalls:
        worst = shortfalls[0]
        extra = f" (and {len(shortfalls) - 1} more)" if len(shortfalls) > 1 else ""
        return Gate(
            code="insurance_below_minimum",
            label="Insurance limits",
            status=GATE_FAIL,
            summary=(
                f"{worst['label']} carried at ${worst['carried']:,.0f} against a "
                f"${worst['required']:,.0f} requirement{extra}."
            ),
            detail={"shortfalls": shortfalls},
        )

    return Gate(
        code="insurance_meets_minimum",
        label="Insurance limits",
        status=GATE_PASS,
        summary="Every required coverage is carried at or above the contract minimum.",
        detail={"shortfalls": []},
    )


def _check_insurance_currency(insurance: dict, policy: dict, as_of: date) -> Gate:
    expires = date.fromisoformat(insurance["certificate_expires"])
    days_remaining = (expires - as_of).days
    warning_days = policy["certificate_expiry_warning_days"]
    detail = {
        "certificate_expires": insurance["certificate_expires"],
        "days_remaining": days_remaining,
        "warning_days": warning_days,
        "as_of": as_of.isoformat(),
    }

    if days_remaining < 0:
        return Gate(
            code="insurance_certificate_expired",
            label="Certificate of insurance",
            status=GATE_FAIL,
            summary=f"Certificate expired {abs(days_remaining)} days ago ({expires.isoformat()}).",
            detail=detail,
        )

    if days_remaining <= warning_days:
        return Gate(
            code="insurance_certificate_expiring",
            label="Certificate of insurance",
            status=GATE_WARN,
            summary=(
                f"Certificate expires in {days_remaining} days ({expires.isoformat()}); a renewed "
                f"certificate is required before subcontract execution."
            ),
            detail=detail,
        )

    return Gate(
        code="insurance_certificate_current",
        label="Certificate of insurance",
        status=GATE_PASS,
        summary=f"Certificate current through {expires.isoformat()}.",
        detail=detail,
    )


def _check_single_project_bond(bonding: dict, policy: dict, bid_amount: float) -> Gate:
    """Whether the surety would write this package for this firm.

    The bid is measured against the single-project limit less a headroom margin,
    because a subcontract that consumes a firm's entire single-project capacity
    leaves nothing for the change orders the job will actually generate.
    """
    limit = bonding["single_project_limit"]
    headroom_pct = policy["single_project_bond_headroom_pct"]
    usable = limit * (1 - headroom_pct / 100)
    detail = {
        "bid_amount": bid_amount,
        "single_project_limit": limit,
        "headroom_pct": headroom_pct,
        "usable_limit": round(usable, 2),
        "surety": bonding.get("surety"),
        "am_best_rating": bonding.get("am_best_rating"),
    }

    if bid_amount > usable:
        return Gate(
            code="bond_single_project_exceeded",
            label="Single-project bonding capacity",
            status=GATE_FAIL,
            summary=(
                f"Bid of ${bid_amount:,.0f} exceeds the usable single-project limit of "
                f"${usable:,.0f} ({headroom_pct:.0f}% headroom on a ${limit:,.0f} limit)."
            ),
            detail=detail,
        )

    return Gate(
        code="bond_single_project_within_limit",
        label="Single-project bonding capacity",
        status=GATE_PASS,
        summary=(
            f"Bid of ${bid_amount:,.0f} sits well inside the ${limit:,.0f} single-project limit "
            f"written by {bonding.get('surety')}."
        ),
        detail=detail,
    )


def _check_aggregate_capacity(bonding: dict, policy: dict, bid_amount: float) -> Gate:
    """Backlog against aggregate bonding capacity, including this bid.

    A firm can be comfortably inside its per-project limit and still be unable to
    take the work, because everything else they are already building counts
    against the same aggregate line.
    """
    aggregate = bonding["aggregate_limit"]
    backlog = bonding["current_backlog"]
    projected = backlog + bid_amount
    utilization = round(projected / aggregate * 100, 1) if aggregate else 0.0
    maximum = policy["aggregate_backlog_utilization_max_pct"]
    detail = {
        "aggregate_limit": aggregate,
        "current_backlog": backlog,
        "projected_backlog": projected,
        "utilization_pct": utilization,
        "maximum_pct": maximum,
    }

    if utilization > maximum:
        return Gate(
            code="bond_aggregate_capacity_strained",
            label="Aggregate bonding capacity",
            status=GATE_WARN,
            summary=(
                f"Backlog of ${backlog:,.0f} plus this bid reaches {utilization:.1f}% of the "
                f"${aggregate:,.0f} aggregate limit, above the {maximum:.0f}% policy ceiling."
            ),
            detail=detail,
        )

    return Gate(
        code="bond_aggregate_capacity_available",
        label="Aggregate bonding capacity",
        status=GATE_PASS,
        summary=(
            f"Projected backlog reaches {utilization:.1f}% of the ${aggregate:,.0f} aggregate "
            f"limit, inside the {maximum:.0f}% ceiling."
        ),
        detail=detail,
    )


def _check_prequal_currency(record: dict, policy: dict, as_of: date) -> Gate:
    reviewed = date.fromisoformat(record["last_reviewed"])
    months = _months_between(reviewed, as_of)
    cycle = policy["review_cycle_months"]
    detail = {"last_reviewed": record["last_reviewed"], "months_since_review": months,
              "review_cycle_months": cycle}

    if months > cycle:
        return Gate(
            code="prequal_review_stale",
            label="Prequalification review",
            status=GATE_WARN,
            summary=(
                f"Last prequalified {months} months ago, past the {cycle}-month review cycle."
            ),
            detail=detail,
        )

    return Gate(
        code="prequal_review_current",
        label="Prequalification review",
        status=GATE_PASS,
        summary=f"Prequalified {reviewed.isoformat()}, inside the {cycle}-month cycle.",
        detail=detail,
    )


def evaluate_vendor(
    record: dict,
    policy: dict,
    bid_amount: float,
    as_of: date,
) -> VendorPrequalification:
    """Run every gate against one subcontractor's prequalification record."""
    prequal = record["prequalification"]
    gates = [
        _check_emr(prequal["safety"], policy),
        _check_insurance_limits(prequal["insurance"], policy),
        _check_insurance_currency(prequal["insurance"], policy, as_of),
        _check_single_project_bond(prequal["bonding"], policy, bid_amount),
        _check_aggregate_capacity(prequal["bonding"], policy, bid_amount),
        _check_prequal_currency(prequal, policy, as_of),
    ]

    return VendorPrequalification(
        vendor_id=record["vendor_id"],
        vendor_name=record["name"],
        gates=gates,
        emr=prequal["safety"]["emr"],
        last_reviewed=prequal["last_reviewed"],
        safety=prequal["safety"],
        certifications=prequal["certifications"],
        bonding=prequal["bonding"],
        insurance=prequal["insurance"],
        performance=prequal["performance"],
        schedule=prequal["schedule"],
    )


def evaluate_package(
    vendor_records: dict[str, dict],
    policy: dict,
    bid_amounts: dict[str, float],
    as_of: date,
) -> dict[str, VendorPrequalification]:
    """Evaluate every bidder in a package, keyed by vendor_id.

    `bid_amounts` should carry the LEVELED total, not the submitted one: bonding
    capacity has to absorb what the work will really cost, and the leveled figure
    is the pipeline's best estimate of that.
    """
    return {
        vendor_id: evaluate_vendor(record, policy, bid_amounts.get(vendor_id, 0.0), as_of)
        for vendor_id, record in vendor_records.items()
        if vendor_id in bid_amounts
    }
