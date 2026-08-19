"""Weighted award recommendation.

Leveling produces a defensible number. It does not produce a decision, because
price is not the only thing being bought: an estimator is also buying a safety
record, a change-order history, and a crew that shows up when the schedule says
so. Award models exist to make that trade explicit.

The failure this guards against is the common one. An evaluation that never
writes its non-price factors down does not become neutral; it silently becomes
price-only, and the low bidder's first change order arrives at 40% complete. So
the weights here are real inputs, defaulted to a conventional split and meant to
be retuned by the reviewer, with the ranking recomputing as they move.

Two rules keep the model honest:

  * Gates are not weights. A bidder who fails prequalification is scored anyway
    -- the estimator should see exactly what the gate cost them -- but is never
    ranked or recommended. See prequalification.py for why that separation is
    deliberate.
  * Every factor score reports the basis it was computed from, so a number in
    the UI can always be traced to the evidence underneath it.
"""

from dataclasses import dataclass, field

from src.comparison.compare import PackageComparison
from src.comparison.prequalification import VendorPrequalification

# A conventional starting split, not a standard. Real weightings vary by project
# type, by owner, and by whether the work is public or private -- which is the
# argument for making them editable rather than for picking better constants.
DEFAULT_WEIGHTS: dict[str, float] = {
    "cost": 40.0,
    "experience": 30.0,
    "safety": 20.0,
    "schedule": 10.0,
}

FACTOR_LABELS = {
    "cost": "Leveled cost",
    "experience": "Experience and past performance",
    "safety": "Safety record",
    "schedule": "Schedule and capacity",
}

FACTOR_ORDER = ["cost", "experience", "safety", "schedule"]

# Sub-weights inside the experience composite. Change-order rate leads because
# it is the factor that most directly predicts what a bid will actually cost
# once the job is running.
EXPERIENCE_SUBWEIGHTS = {
    "change_orders": 0.40,
    "closeout": 0.30,
    "depth": 0.20,
    "relationship": 0.10,
}

# Reference points for normalizing raw history into a 0-100 score.
CHANGE_ORDER_PENALTY_PER_PCT = 10.0
BENCHMARK_COMPLETED_PACKAGES = 6
BENCHMARK_RELATIONSHIP_YEARS = 8

# Schedule sub-weights and penalties.
SCHEDULE_SUBWEIGHTS = {"duration": 0.50, "mobilization": 0.30, "crew": 0.20}
DURATION_PENALTY_PER_WEEK = 15.0
MOBILIZATION_PENALTY_PER_WEEK = 20.0


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


@dataclass
class FactorScore:
    factor: str
    label: str
    score: float
    weight: float
    basis: str
    detail: dict = field(default_factory=dict)

    @property
    def weighted(self) -> float:
        return round(self.score * self.weight / 100, 2)


@dataclass
class VendorScore:
    vendor_id: str
    vendor_name: str
    adjusted_total: float
    submitted_total: float
    factors: list[FactorScore]
    eligible: bool
    disqualifying_reason: str | None = None
    rank: int | None = None

    @property
    def total_score(self) -> float:
        return round(sum(f.weighted for f in self.factors), 2)

    def factor(self, name: str) -> FactorScore:
        return next(f for f in self.factors if f.factor == name)


@dataclass
class AwardRecommendation:
    weights: dict[str, float]
    scores: list[VendorScore]
    narrative: str
    recommended: VendorScore | None = None
    runner_up: VendorScore | None = None
    lowest_leveled_vendor_id: str | None = None

    @property
    def eligible_scores(self) -> list[VendorScore]:
        return [s for s in self.scores if s.eligible]

    @property
    def excluded_scores(self) -> list[VendorScore]:
        return [s for s in self.scores if not s.eligible]

    @property
    def margin(self) -> float:
        if self.recommended is None or self.runner_up is None:
            return 0.0
        return round(self.recommended.total_score - self.runner_up.total_score, 2)

    @property
    def agrees_with_lowest_leveled(self) -> bool:
        """Whether the weighted model lands on the cheapest leveled bid."""
        if self.recommended is None:
            return False
        return self.recommended.vendor_id == self.lowest_leveled_vendor_id


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """Accept any positive weights and express them as percentages summing to 100.

    A reviewer dragging four sliders will not land on exactly 100, and refusing
    to score until they do would make the control useless. Proportions are what
    the model actually needs.
    """
    missing = set(DEFAULT_WEIGHTS) - set(weights)
    if missing:
        raise ValueError(f"Missing weight(s): {', '.join(sorted(missing))}")
    if any(w < 0 for w in weights.values()):
        raise ValueError("Weights cannot be negative")

    total = sum(weights[f] for f in DEFAULT_WEIGHTS)
    if total <= 0:
        raise ValueError("At least one weight must be greater than zero")

    return {factor: round(weights[factor] / total * 100, 4) for factor in DEFAULT_WEIGHTS}


def score_cost(adjusted_total: float, best_total: float, weight: float) -> FactorScore:
    """Leveled cost, scored against the cheapest leveled bid in the package.

    Measured against every bid, not only the eligible ones, so gating a cheap
    bidder does not quietly inflate everyone else's cost score. The estimator
    should be able to see what the gate cost them.
    """
    score = _clamp(best_total / adjusted_total * 100) if adjusted_total else 0.0
    premium = adjusted_total - best_total
    basis = (
        f"${adjusted_total:,.0f} leveled"
        + (f", ${premium:,.0f} above the lowest leveled bid" if premium > 0 else ", the lowest leveled bid")
    )
    return FactorScore(
        factor="cost",
        label=FACTOR_LABELS["cost"],
        score=round(score, 2),
        weight=weight,
        basis=basis,
        detail={"adjusted_total": adjusted_total, "best_total": best_total,
                "premium_over_best": round(premium, 2)},
    )


def score_safety(prequal: VendorPrequalification, policy: dict, weight: float) -> FactorScore:
    """EMR mapped onto the band between the high-risk ceiling and disqualification.

    An EMR at or below the high-risk ceiling scores 100; there is nothing to gain
    from being safer than the safest category the GC underwrites. At the
    disqualifying threshold it scores 0.
    """
    emr = prequal.emr
    best = policy["emr_high_risk_maximum"]
    worst = policy["emr_disqualifying"]
    score = _clamp((worst - emr) / (worst - best) * 100)

    return FactorScore(
        factor="safety",
        label=FACTOR_LABELS["safety"],
        score=round(score, 2),
        weight=weight,
        basis=(
            f"EMR {emr:.2f} on a scale where {best:.2f} scores 100 and {worst:.2f} scores 0"
        ),
        detail={"emr": emr, "best": best, "worst": worst,
                "trir": prequal.safety_trir, "lost_time_incidents_3yr": prequal.lost_time_incidents},
    )


def score_experience(prequal: VendorPrequalification, weight: float) -> FactorScore:
    """Composite of change-order history, closeout, depth, and relationship length."""
    perf = prequal.performance
    co_rate = perf["change_order_rate_pct"]
    closeout = perf["on_time_closeout_pct"]
    completed = perf["packages_completed"]
    years = perf["years_working_together"]

    parts = {
        "change_orders": _clamp(100 - co_rate * CHANGE_ORDER_PENALTY_PER_PCT),
        "closeout": _clamp(closeout),
        "depth": _clamp(completed / BENCHMARK_COMPLETED_PACKAGES * 100),
        "relationship": _clamp(years / BENCHMARK_RELATIONSHIP_YEARS * 100),
    }
    score = sum(parts[k] * EXPERIENCE_SUBWEIGHTS[k] for k in parts)

    return FactorScore(
        factor="experience",
        label=FACTOR_LABELS["experience"],
        score=round(score, 2),
        weight=weight,
        basis=(
            f"{co_rate:.1f}% change-order rate, {closeout:.0f}% on-time closeout, "
            f"{completed} package(s) completed over {years} years"
        ),
        detail={"components": {k: round(v, 2) for k, v in parts.items()},
                "subweights": EXPERIENCE_SUBWEIGHTS,
                "change_order_rate_pct": co_rate, "on_time_closeout_pct": closeout,
                "packages_completed": completed, "years_working_together": years,
                "avg_rfi_per_package": perf.get("avg_rfi_per_package")},
    )


def score_schedule(prequal: VendorPrequalification, requirement: dict, weight: float) -> FactorScore:
    """Proposed duration, mobilization, and committed crew against the package need."""
    sched = prequal.schedule
    required_weeks = requirement["required_duration_weeks"]
    max_mobilization = requirement["max_mobilization_weeks"]
    min_crew = requirement["min_crew_size"]

    weeks_over = max(0, sched["proposed_duration_weeks"] - required_weeks)
    mobilization_over = max(0, sched["mobilization_weeks"] - max_mobilization)
    crew = sched["crew_size_committed"]

    parts = {
        "duration": _clamp(100 - weeks_over * DURATION_PENALTY_PER_WEEK),
        "mobilization": _clamp(100 - mobilization_over * MOBILIZATION_PENALTY_PER_WEEK),
        "crew": _clamp(crew / min_crew * 100) if min_crew else 100.0,
    }
    score = sum(parts[k] * SCHEDULE_SUBWEIGHTS[k] for k in parts)

    if weeks_over:
        basis = (
            f"{sched['proposed_duration_weeks']} weeks against a {required_weeks}-week "
            f"requirement ({weeks_over} over), {crew}-person crew"
        )
    else:
        basis = (
            f"{sched['proposed_duration_weeks']} weeks inside the {required_weeks}-week "
            f"requirement, {crew}-person crew"
        )

    return FactorScore(
        factor="schedule",
        label=FACTOR_LABELS["schedule"],
        score=round(score, 2),
        weight=weight,
        basis=basis,
        detail={"components": {k: round(v, 2) for k, v in parts.items()},
                "subweights": SCHEDULE_SUBWEIGHTS,
                "proposed_duration_weeks": sched["proposed_duration_weeks"],
                "required_duration_weeks": required_weeks,
                "weeks_over": weeks_over,
                "mobilization_weeks": sched["mobilization_weeks"],
                "crew_size_committed": crew,
                "concurrent_awarded_packages": sched.get("concurrent_awarded_packages")},
    )


def build_narrative(rec: AwardRecommendation, comparison: PackageComparison) -> str:
    """Compose the award rationale in plain language.

    Deterministic prose, not a model call. A recommendation an estimator signs
    their name to has to say the same thing every time it is generated, and has
    to be reconstructible from the numbers alone.
    """
    if rec.recommended is None:
        return (
            "No bidder in this package clears prequalification, so there is no award "
            "recommendation to make. Every submission is blocked by at least one gate; "
            "the package needs additional bidders or a documented policy exception."
        )

    winner = rec.recommended
    lines: list[str] = []

    lead = (
        f"Recommend award to {winner.vendor_name} at ${winner.adjusted_total:,.0f} leveled, "
        f"scoring {winner.total_score:.1f} of 100"
    )
    if rec.runner_up is not None:
        lead += (
            f", ahead of {rec.runner_up.vendor_name} at {rec.runner_up.total_score:.1f} "
            f"({rec.margin:.1f} points)."
        )
    else:
        lead += ", the only bidder clearing prequalification."
    lines.append(lead)

    # Where the recommendation sits relative to the two price answers.
    lowest_submitted = comparison.lowest_submitted
    if rec.agrees_with_lowest_leveled:
        if lowest_submitted.vendor_id != winner.vendor_id:
            lines.append(
                f"This is also the lowest leveled bid. It is not the lowest submitted bid: "
                f"{lowest_submitted.vendor_name} submitted ${lowest_submitted.submitted_total:,.0f} "
                f"but rises to ${lowest_submitted.adjusted_total:,.0f} once excluded scope is priced."
            )
        else:
            lines.append("This is both the lowest submitted and the lowest leveled bid.")
    else:
        cheapest = min(rec.eligible_scores, key=lambda s: s.adjusted_total)
        premium = winner.adjusted_total - cheapest.adjusted_total
        lines.append(
            f"This is not the cheapest eligible bid. {cheapest.vendor_name} is "
            f"${premium:,.0f} lower leveled, and the weighted model still prefers "
            f"{winner.vendor_name} on non-price factors."
        )

    # The strongest and weakest factor, so the reader knows what carried it.
    ranked_factors = sorted(winner.factors, key=lambda f: f.score, reverse=True)
    best, worst = ranked_factors[0], ranked_factors[-1]
    lines.append(
        f"Strongest factor is {best.label.lower()} at {best.score:.0f} of 100 ({best.basis}); "
        f"weakest is {worst.label.lower()} at {worst.score:.0f} ({worst.basis})."
    )

    # Anyone the gates removed, and what it cost to remove them.
    if rec.excluded_scores:
        by_price = sorted(rec.excluded_scores, key=lambda s: s.adjusted_total)
        parts = []
        for excluded in by_price:
            delta = excluded.adjusted_total - winner.adjusted_total
            position = (
                f"${abs(delta):,.0f} {'below' if delta < 0 else 'above'} the recommendation"
            )
            parts.append(f"{excluded.vendor_name} ({position}) -- {excluded.disqualifying_reason}")
        lines.append(
            f"{len(by_price)} bidder(s) were excluded before scoring: " + " ".join(parts)
        )

    lines.append(
        "Weights applied: "
        + ", ".join(
            f"{FACTOR_LABELS[f].lower()} {rec.weights[f]:.0f}%" for f in FACTOR_ORDER
        )
        + "."
    )

    return " ".join(lines)


def recommend_award(
    comparison: PackageComparison,
    prequalification: dict[str, VendorPrequalification],
    policy: dict,
    schedule_requirement: dict,
    weights: dict[str, float] | None = None,
) -> AwardRecommendation:
    """Score every bidder, rank the eligible ones, and explain the result."""
    resolved = normalize_weights(weights or DEFAULT_WEIGHTS)
    best_total = min(v.adjusted_total for v in comparison.vendors)

    scores: list[VendorScore] = []
    for vendor in comparison.vendors:
        prequal = prequalification.get(vendor.vendor_id)
        if prequal is None:
            # No prequalification record is itself disqualifying: the GC cannot
            # award to a firm it has not vetted.
            scores.append(VendorScore(
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                adjusted_total=vendor.adjusted_total,
                submitted_total=vendor.submitted_total,
                factors=[score_cost(vendor.adjusted_total, best_total, resolved["cost"])],
                eligible=False,
                disqualifying_reason="No prequalification record on file.",
            ))
            continue

        scores.append(VendorScore(
            vendor_id=vendor.vendor_id,
            vendor_name=vendor.vendor_name,
            adjusted_total=vendor.adjusted_total,
            submitted_total=vendor.submitted_total,
            factors=[
                score_cost(vendor.adjusted_total, best_total, resolved["cost"]),
                score_experience(prequal, resolved["experience"]),
                score_safety(prequal, policy, resolved["safety"]),
                score_schedule(prequal, schedule_requirement, resolved["schedule"]),
            ],
            eligible=prequal.eligible,
            disqualifying_reason=prequal.disqualifying_reason,
        ))

    # Rank eligible bidders only. Ties break on the lower leveled total, which is
    # the tiebreak an estimator would defend in a bid-review meeting.
    eligible = sorted(
        [s for s in scores if s.eligible],
        key=lambda s: (-s.total_score, s.adjusted_total),
    )
    for rank, score in enumerate(eligible, start=1):
        score.rank = rank

    recommendation = AwardRecommendation(
        weights=resolved,
        scores=scores,
        narrative="",
        recommended=eligible[0] if eligible else None,
        runner_up=eligible[1] if len(eligible) > 1 else None,
        lowest_leveled_vendor_id=comparison.lowest_adjusted.vendor_id,
    )
    recommendation.narrative = build_narrative(recommendation, comparison)
    return recommendation
