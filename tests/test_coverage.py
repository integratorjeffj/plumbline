"""Bid coverage and addendum acknowledgment."""

import pytest

from src.comparison.coverage import (
    COVERAGE_HEALTHY,
    COVERAGE_INSUFFICIENT,
    COVERAGE_THIN,
    PackageCoverage,
    build_coverage,
    check_addenda_acknowledgment,
    check_coverage,
    resolve_acknowledgment,
)
from src.normalization.normalize import NormalizedBid


def _ack(coverage, vendor_id):
    return next(a for a in coverage.acknowledgments if a.vendor_id == vendor_id)


def _codes(anomalies):
    return {a.code for a in anomalies}


# --------------------------------------------------------------------------
# Invitation accounting
# --------------------------------------------------------------------------

def test_coverage_counts_every_invitation_outcome(package_coverage):
    assert package_coverage.invited_count == 7
    assert len(package_coverage.responded) == 4
    assert len(package_coverage.declined) == 2
    assert len(package_coverage.no_response) == 1


def test_response_rate_is_measured_from_the_invitation_list(package_coverage):
    assert package_coverage.response_rate_pct == 57.1


def test_responded_count_matches_the_bidders_actually_compared(package_coverage, package_result):
    assert len(package_coverage.responded) == len(package_result.comparison.vendors)


def test_a_declined_invitation_carries_its_reason(package_coverage):
    reasons = {i.vendor_name: i.note for i in package_coverage.declined}
    assert "Northgate Electric Company" in reasons
    assert all(note for note in reasons.values()), "a decline without a reason is a lost signal"


# --------------------------------------------------------------------------
# Coverage health bands
# --------------------------------------------------------------------------

def test_four_responsive_bidders_reads_as_healthy(package_coverage):
    assert package_coverage.health == COVERAGE_HEALTHY
    assert check_coverage(package_coverage) and "coverage_below_minimum" not in _codes(
        check_coverage(package_coverage)
    )


def _coverage_with(responded: int, invited: int, policy) -> PackageCoverage:
    from src.comparison.coverage import Invitation

    invitations = [
        Invitation(f"v{i}", f"Vendor {i}", "2026-07-06",
                   "responded" if i < responded else "no_response")
        for i in range(invited)
    ]
    return PackageCoverage(
        bid_package_number="test", issued_date="2026-07-06", bids_due="2026-08-07",
        invitations=invitations, acknowledgments=[], current_addendum=0,
        minimum_bidders=policy["minimum_bidders_per_package"],
        target_bidders=policy["target_bidders_per_package"],
        minimum_response_rate_pct=policy["minimum_response_rate_pct"],
    )


def test_below_the_minimum_bidder_count_is_insufficient(coverage_policy):
    coverage = _coverage_with(responded=2, invited=7, policy=coverage_policy)
    assert coverage.health == COVERAGE_INSUFFICIENT
    assert "coverage_below_minimum" in _codes(check_coverage(coverage))


def test_meeting_the_minimum_but_not_the_target_is_thin(coverage_policy):
    coverage = _coverage_with(responded=3, invited=7, policy=coverage_policy)
    assert coverage.health == COVERAGE_THIN
    assert "coverage_thin" in _codes(check_coverage(coverage))


def test_a_weak_response_rate_is_thin_even_at_the_target_count(coverage_policy):
    """Four bidders out of twenty invited is not the same market as four out of seven."""
    coverage = _coverage_with(responded=4, invited=20, policy=coverage_policy)
    assert coverage.response_rate_pct < coverage_policy["minimum_response_rate_pct"]
    assert coverage.health == COVERAGE_THIN


def test_silent_invitations_are_reported(package_coverage):
    anomalies = [a for a in check_coverage(package_coverage) if a.code == "invitation_no_response"]
    assert len(anomalies) == 1
    assert "Brightline Electrical Services" in anomalies[0].summary


# --------------------------------------------------------------------------
# Addendum acknowledgment
# --------------------------------------------------------------------------

def test_a_bidder_on_the_current_revision_has_acknowledged_everything(package_coverage):
    ack = _ack(package_coverage, "ironclad-power")
    assert ack.acknowledged_through == 3
    assert ack.missing_addenda == []
    assert ack.acknowledged is True


def test_a_bidder_on_a_stale_revision_is_missing_every_later_addendum(package_coverage):
    """Meridian priced Revision 1, so Addenda 2 and 3 are not in its number."""
    ack = _ack(package_coverage, "meridian-electric")
    assert ack.drawing_revision_referenced == "Revision 1"
    assert ack.acknowledged_through == 1
    assert ack.missing_addenda == [2, 3]
    assert ack.acknowledged is False


def test_the_missing_addendum_is_the_one_that_added_the_arc_flash_requirement(
    package_coverage, sample_data_dir
):
    """Ties the acknowledgment gap to what the bidder actually failed to price."""
    import json

    addenda = json.loads(
        (sample_data_dir / "addenda" / "26-0147-BP-26.json").read_text(encoding="utf-8")
    )
    addendum_3 = next(a for a in addenda["addenda"] if a["number"] == 3)
    assert "arc-flash" in addendum_3["description"].lower()
    assert 3 in _ack(package_coverage, "meridian-electric").missing_addenda


def test_unacknowledged_bidders_are_collected(package_coverage):
    assert [a.vendor_id for a in package_coverage.unacknowledged] == ["meridian-electric"]


def test_a_stale_revision_raises_a_high_severity_finding(package_coverage):
    anomalies = check_addenda_acknowledgment(package_coverage)
    assert len(anomalies) == 1
    assert anomalies[0].code == "addenda_not_acknowledged"
    assert anomalies[0].severity == "HIGH"
    assert "Addenda 2, 3" in anomalies[0].summary


def test_an_unstated_revision_acknowledges_nothing_and_is_reported_separately(sample_data_dir):
    """Unstated is not stale: nothing was claimed, so nothing is confirmed."""
    import json

    addenda = json.loads(
        (sample_data_dir / "addenda" / "26-0147-BP-26.json").read_text(encoding="utf-8")
    )
    bid = NormalizedBid(
        vendor_id="silent-electric", vendor_name="Silent Electric", revision_label="Original",
        submitted_total=190000.0, scope={}, line_items=[],
        drawing_revision_referenced=None,
    )
    ack = resolve_acknowledgment(bid, addenda)
    assert ack.unstated is True
    assert ack.missing_addenda == [1, 2, 3]

    coverage = PackageCoverage(
        bid_package_number="test", issued_date="2026-07-06", bids_due="2026-08-07",
        invitations=[], acknowledgments=[ack], current_addendum=3,
        minimum_bidders=3, target_bidders=4, minimum_response_rate_pct=40.0,
    )
    anomalies = check_addenda_acknowledgment(coverage)
    assert anomalies[0].code == "addenda_acknowledgment_unstated"
    assert anomalies[0].severity == "MEDIUM"


def test_superseded_bids_are_excluded_from_acknowledgment(
    package_result, sample_data_dir, coverage_policy
):
    """Ironclad's original is superseded; it should not appear twice."""
    from src.comparison.coverage import load_addenda, load_itb

    coverage = build_coverage(
        load_itb(sample_data_dir / "itb" / "26-0147-BP-26.json"),
        load_addenda(sample_data_dir / "addenda" / "26-0147-BP-26.json"),
        package_result.bids,
        coverage_policy,
    )
    ironclad = [a for a in coverage.acknowledgments if a.vendor_id == "ironclad-power"]
    assert len(ironclad) == 1
