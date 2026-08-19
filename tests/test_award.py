"""Weighted award recommendation: scoring, gating, and re-ranking."""

import pytest

from src.comparison.award import (
    DEFAULT_WEIGHTS,
    normalize_weights,
    recommend_award,
)

TRACK_RECORD_WEIGHTS = {"cost": 10, "experience": 60, "safety": 20, "schedule": 10}
PRICE_ONLY_WEIGHTS = {"cost": 100, "experience": 0, "safety": 0, "schedule": 0}


def _by_id(recommendation):
    return {s.vendor_id: s for s in recommendation.scores}


# --------------------------------------------------------------------------
# Weight handling
# --------------------------------------------------------------------------

def test_default_weights_are_the_conventional_split():
    assert DEFAULT_WEIGHTS == {"cost": 40.0, "experience": 30.0, "safety": 20.0, "schedule": 10.0}


def test_weights_are_normalized_to_proportions():
    """Sliders will not land on 100; proportions are what the model needs."""
    normalized = normalize_weights({"cost": 4, "experience": 3, "safety": 2, "schedule": 1})
    assert normalized == {"cost": 40.0, "experience": 30.0, "safety": 20.0, "schedule": 10.0}


def test_missing_weight_is_rejected():
    with pytest.raises(ValueError, match="Missing weight"):
        normalize_weights({"cost": 50, "experience": 50})


def test_negative_weight_is_rejected():
    with pytest.raises(ValueError, match="negative"):
        normalize_weights({"cost": -1, "experience": 60, "safety": 20, "schedule": 21})


def test_all_zero_weights_are_rejected():
    with pytest.raises(ValueError, match="greater than zero"):
        normalize_weights({"cost": 0, "experience": 0, "safety": 0, "schedule": 0})


# --------------------------------------------------------------------------
# Gates are not weights
# --------------------------------------------------------------------------

def test_gated_bidders_are_scored_but_never_ranked(package_award):
    """The estimator should see what the gate cost, without it becoming an option."""
    meridian = _by_id(package_award)["meridian-electric"]
    assert meridian.eligible is False
    assert meridian.rank is None
    assert meridian.total_score > 0, "a gated bidder is still scored"


def test_a_gated_bidder_can_outscore_an_eligible_one_on_cost(package_award):
    """Meridian is second-cheapest leveled and still cannot be recommended."""
    scores = _by_id(package_award)
    meridian = scores["meridian-electric"]
    apex = scores["apex-electrical"]

    assert meridian.factor("cost").score > apex.factor("cost").score
    assert apex.rank is not None and meridian.rank is None


def test_only_eligible_bidders_are_ranked_and_ranks_are_contiguous(package_award):
    ranks = sorted(s.rank for s in package_award.eligible_scores)
    assert ranks == list(range(1, len(ranks) + 1))
    assert all(s.rank is None for s in package_award.excluded_scores)


def test_price_only_weighting_still_cannot_promote_a_gated_bidder(
    package_result, package_prequal, prequal_policy, schedule_requirement
):
    """The gate is the whole point: no weighting recovers a disqualified bidder."""
    recommendation = recommend_award(
        package_result.comparison, package_prequal, prequal_policy,
        schedule_requirement, PRICE_ONLY_WEIGHTS,
    )
    assert recommendation.recommended.vendor_id == "ironclad-power"
    assert {s.vendor_id for s in recommendation.excluded_scores} == {
        "meridian-electric", "voltage-systems"
    }


# --------------------------------------------------------------------------
# Re-ranking on weight change
# --------------------------------------------------------------------------

def test_default_weighting_recommends_the_leveled_leader(package_award):
    assert package_award.recommended.vendor_id == "ironclad-power"
    assert package_award.agrees_with_lowest_leveled is True


def test_weighting_track_record_over_price_changes_the_recommendation(
    package_result, package_prequal, prequal_policy, schedule_requirement
):
    """The control has to be able to change the answer, or it is decoration."""
    recommendation = recommend_award(
        package_result.comparison, package_prequal, prequal_policy,
        schedule_requirement, TRACK_RECORD_WEIGHTS,
    )
    assert recommendation.recommended.vendor_id == "apex-electrical"
    assert recommendation.agrees_with_lowest_leveled is False
    assert recommendation.margin > 0


def test_the_two_eligible_bidders_trade_places_on_experience_and_safety(package_award):
    scores = _by_id(package_award)
    ironclad, apex = scores["ironclad-power"], scores["apex-electrical"]

    assert apex.factor("experience").score > ironclad.factor("experience").score
    assert ironclad.factor("safety").score > apex.factor("safety").score


# --------------------------------------------------------------------------
# Factor scoring
# --------------------------------------------------------------------------

def test_cost_is_scored_against_the_cheapest_leveled_bid_including_gated_ones(package_award):
    """Gating a cheap bidder must not inflate everyone else's cost score."""
    scores = _by_id(package_award)
    best = min(s.adjusted_total for s in package_award.scores)
    assert scores["ironclad-power"].adjusted_total == best
    assert scores["ironclad-power"].factor("cost").score == 100.0
    assert scores["voltage-systems"].factor("cost").detail["best_total"] == best


def test_safety_score_maps_emr_onto_the_policy_band(package_award, prequal_policy):
    ironclad = _by_id(package_award)["ironclad-power"]
    # EMR 0.78 is below the 0.85 high-risk ceiling, so it tops out rather than
    # scoring above 100.
    assert ironclad.factor("safety").score == 100.0

    meridian = _by_id(package_award)["meridian-electric"]
    expected = (prequal_policy["emr_disqualifying"] - 1.12) / (
        prequal_policy["emr_disqualifying"] - prequal_policy["emr_high_risk_maximum"]
    ) * 100
    assert meridian.factor("safety").score == pytest.approx(round(expected, 2))


def test_schedule_penalizes_a_bidder_who_cannot_hit_the_required_duration(package_award):
    voltage = _by_id(package_award)["voltage-systems"]
    schedule = voltage.factor("schedule")
    assert schedule.detail["weeks_over"] == 4
    assert schedule.score < 60


def test_a_bidder_inside_every_schedule_requirement_scores_full_marks(package_award):
    assert _by_id(package_award)["ironclad-power"].factor("schedule").score == 100.0


def test_experience_leads_on_change_order_rate(package_award):
    components = _by_id(package_award)["voltage-systems"].factor("experience").detail["components"]
    assert components["change_orders"] < 10, "a 9.8% change-order rate should be near zero"


def test_every_factor_reports_the_basis_it_was_computed_from(package_award):
    for score in package_award.scores:
        for factor in score.factors:
            assert factor.basis, f"{score.vendor_name}/{factor.factor} has no stated basis"


def test_weighted_contributions_sum_to_the_total(package_award):
    for score in package_award.scores:
        assert score.total_score == pytest.approx(
            round(sum(f.weighted for f in score.factors), 2)
        )


# --------------------------------------------------------------------------
# Narrative
# --------------------------------------------------------------------------

def test_narrative_names_the_recommendation_and_the_runner_up(package_award):
    narrative = package_award.narrative
    assert "Ironclad Power & Electric" in narrative
    assert "Apex Electrical Contractors" in narrative
    assert "$186,250" in narrative


def test_narrative_explains_why_the_low_submitted_bid_is_not_the_recommendation(package_award):
    assert "Voltage Systems Inc. submitted $167,400" in package_award.narrative
    assert "$223,700" in package_award.narrative


def test_narrative_records_every_exclusion_with_its_reason(package_award):
    narrative = package_award.narrative
    assert "2 bidder(s) were excluded before scoring" in narrative
    assert "EMR of 1.12" in narrative
    assert "Umbrella / excess liability" in narrative


def test_narrative_states_the_weights_used(package_award):
    assert "leveled cost 40%" in package_award.narrative
    assert "safety record 20%" in package_award.narrative


def test_narrative_is_deterministic(
    package_result, package_prequal, prequal_policy, schedule_requirement
):
    """A recommendation an estimator signs has to read the same every time."""
    first = recommend_award(
        package_result.comparison, package_prequal, prequal_policy, schedule_requirement
    ).narrative
    second = recommend_award(
        package_result.comparison, package_prequal, prequal_policy, schedule_requirement
    ).narrative
    assert first == second


def test_narrative_when_no_bidder_clears_prequalification(
    package_result, package_prequal, prequal_policy, schedule_requirement
):
    gated = {
        vendor_id: prequal for vendor_id, prequal in package_prequal.items()
    }
    for prequal in gated.values():
        for gate in prequal.gates:
            gate.status = "fail"

    recommendation = recommend_award(
        package_result.comparison, gated, prequal_policy, schedule_requirement
    )
    assert recommendation.recommended is None
    assert "No bidder in this package clears prequalification" in recommendation.narrative
    assert recommendation.margin == 0.0
