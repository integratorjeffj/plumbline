"""Prequalification gates: eligibility decided separately from price."""

from datetime import date

import pytest

from src.comparison.prequalification import (
    GATE_FAIL,
    GATE_PASS,
    GATE_WARN,
    evaluate_vendor,
)


def _gate(result, code):
    matches = [g for g in result.gates if g.code == code]
    return matches[0] if matches else None


def _codes(result, status=None):
    return {g.code for g in result.gates if status is None or g.status == status}


# --------------------------------------------------------------------------
# EMR: the gate that removes a competitively priced bidder
# --------------------------------------------------------------------------

def test_meridian_is_gated_on_emr_despite_a_near_tie_price(package_prequal, package_result):
    """The finding leveling alone cannot produce.

    Meridian levels to second at $188,550, within $2,300 of the leading bid.
    On price it is a live candidate; on safety it is not eligible at all.
    """
    meridian = package_prequal["meridian-electric"]
    assert meridian.eligible is False
    assert _gate(meridian, "emr_above_maximum").status == GATE_FAIL
    assert meridian.emr == 1.12

    comparison = {v.vendor_id: v for v in package_result.comparison.vendors}
    leader = min(package_result.comparison.vendors, key=lambda v: v.adjusted_total)
    gap = comparison["meridian-electric"].adjusted_total - leader.adjusted_total
    assert 0 < gap < 5000, "Meridian should be priced close enough that the gate is what decides it"


def test_emr_between_the_two_ceilings_warns_without_disqualifying(package_prequal):
    """Apex at 0.89 clears the 1.00 maximum but not the 0.85 high-risk ceiling."""
    apex = package_prequal["apex-electrical"]
    assert _gate(apex, "emr_above_high_risk_maximum").status == GATE_WARN
    assert apex.eligible is True


def test_low_emr_passes_cleanly(package_prequal):
    ironclad = package_prequal["ironclad-power"]
    assert _gate(ironclad, "emr_within_policy").status == GATE_PASS


def test_emr_at_the_disqualifying_threshold_is_named_as_such(prequal_policy, vendor_records):
    record = {
        "vendor_id": "test-vendor",
        "name": "Test Electric",
        "prequalification": {
            **vendor_records["ironclad-power"]["prequalification"],
            "safety": {"emr": 1.31, "emr_year": 2025, "trir": 5.0, "lost_time_incidents_3yr": 4},
        },
    }
    result = evaluate_vendor(record, prequal_policy, 200000.0, date(2026, 8, 14))
    gate = _gate(result, "emr_above_maximum")
    assert gate.status == GATE_FAIL
    assert "disqualifying" in gate.summary


# --------------------------------------------------------------------------
# Insurance
# --------------------------------------------------------------------------

def test_umbrella_below_the_contract_minimum_is_a_hard_gate(package_prequal):
    voltage = package_prequal["voltage-systems"]
    gate = _gate(voltage, "insurance_below_minimum")
    assert gate.status == GATE_FAIL
    assert voltage.eligible is False
    shortfall = gate.detail["shortfalls"][0]
    assert shortfall["coverage"] == "umbrella"
    assert shortfall["short_by"] == 3000000


def test_certificate_expiring_inside_the_warning_window_warns(package_prequal):
    apex = package_prequal["apex-electrical"]
    gate = _gate(apex, "insurance_certificate_expiring")
    assert gate.status == GATE_WARN
    assert gate.detail["days_remaining"] == 37
    assert apex.eligible is True, "an expiring certificate is a condition, not a disqualification"


def test_expired_certificate_is_a_hard_gate(prequal_policy, vendor_records):
    record = dict(vendor_records["ironclad-power"])
    prequal = {**record["prequalification"]}
    prequal["insurance"] = {**prequal["insurance"], "certificate_expires": "2026-07-01"}
    record["prequalification"] = prequal

    result = evaluate_vendor(record, prequal_policy, 200000.0, date(2026, 8, 14))
    gate = _gate(result, "insurance_certificate_expired")
    assert gate.status == GATE_FAIL
    assert gate.detail["days_remaining"] == -44


def test_current_certificate_passes(package_prequal):
    assert _gate(package_prequal["ironclad-power"], "insurance_certificate_current").status == GATE_PASS


# --------------------------------------------------------------------------
# Bonding capacity
# --------------------------------------------------------------------------

def test_aggregate_capacity_counts_this_bid_against_existing_backlog(package_prequal):
    """Voltage sits inside its per-project limit but not its aggregate line."""
    voltage = package_prequal["voltage-systems"]
    gate = _gate(voltage, "bond_aggregate_capacity_strained")
    assert gate.status == GATE_WARN
    assert gate.detail["utilization_pct"] > gate.detail["maximum_pct"]
    assert _gate(voltage, "bond_single_project_within_limit") is not None


def test_a_bid_beyond_usable_single_project_capacity_fails(prequal_policy, vendor_records):
    """Headroom is applied: the full limit is not usable capacity."""
    record = vendor_records["voltage-systems"]
    limit = record["prequalification"]["bonding"]["single_project_limit"]
    usable = limit * 0.9

    result = evaluate_vendor(record, prequal_policy, usable + 1, date(2026, 8, 14))
    assert _gate(result, "bond_single_project_exceeded").status == GATE_FAIL

    result = evaluate_vendor(record, prequal_policy, usable - 1, date(2026, 8, 14))
    assert _gate(result, "bond_single_project_within_limit").status == GATE_PASS


def test_bond_utilization_is_reported_against_the_aggregate_limit(package_prequal):
    assert package_prequal["ironclad-power"].bond_utilization_pct == 52.6


# --------------------------------------------------------------------------
# Review currency and participation
# --------------------------------------------------------------------------

def test_a_stale_prequalification_review_warns(prequal_policy, vendor_records):
    record = dict(vendor_records["apex-electrical"])
    record["prequalification"] = {**record["prequalification"], "last_reviewed": "2025-01-05"}

    result = evaluate_vendor(record, prequal_policy, 200000.0, date(2026, 8, 14))
    gate = _gate(result, "prequal_review_stale")
    assert gate.status == GATE_WARN
    assert gate.detail["months_since_review"] == 19


def test_participation_certifications_are_surfaced(package_prequal):
    assert package_prequal["apex-electrical"].participation_certifications == ["DBE", "MBE"]
    assert package_prequal["voltage-systems"].participation_certifications == ["WBE", "SBE"]
    assert package_prequal["ironclad-power"].participation_certifications == []


# --------------------------------------------------------------------------
# Package-level shape
# --------------------------------------------------------------------------

def test_every_active_bidder_is_evaluated(package_prequal, package_result):
    assert set(package_prequal) == {v.vendor_id for v in package_result.comparison.vendors}


def test_exactly_two_of_four_bidders_clear_prequalification(package_prequal):
    eligible = {vid for vid, r in package_prequal.items() if r.eligible}
    assert eligible == {"ironclad-power", "apex-electrical"}


def test_the_leveled_winner_is_also_eligible(package_prequal, package_result):
    """If leveling and prequalification disagreed, the demo would need a tiebreak story."""
    leader = min(package_result.comparison.vendors, key=lambda v: v.adjusted_total)
    assert package_prequal[leader.vendor_id].eligible is True


def test_status_reports_the_worst_gate(package_prequal):
    assert package_prequal["ironclad-power"].status == GATE_PASS
    assert package_prequal["apex-electrical"].status == GATE_WARN
    assert package_prequal["meridian-electric"].status == GATE_FAIL


def test_disqualifying_reason_is_empty_for_eligible_bidders(package_prequal):
    assert package_prequal["ironclad-power"].disqualifying_reason is None
    assert "EMR" in package_prequal["meridian-electric"].disqualifying_reason


@pytest.mark.parametrize("vendor_id", ["apex-electrical", "voltage-systems",
                                       "meridian-electric", "ironclad-power"])
def test_every_bidder_runs_every_gate(package_prequal, vendor_id):
    """A rule that did not fire still ran; silence is a result, not an omission."""
    assert len(package_prequal[vendor_id].gates) == 6
