"""REQ-007 / REQ-008: deterministic anomaly detection."""

from src.comparison.anomalies import (
    PRICING_OUTLIER_LOW_PCT,
    check_arithmetic,
    check_drawing_revision,
    check_required_scope_coverage,
    load_required_scope,
)
from src.normalization.normalize import NormalizedBid


def _codes(anomalies) -> set[str]:
    return {a.code for a in anomalies}


def _find(anomalies, code, vendor_id=None):
    return [a for a in anomalies if a.code == code and (vendor_id is None or a.vendor_id == vendor_id)]


# --------------------------------------------------------------------------
# Arithmetic validation
# --------------------------------------------------------------------------

def test_arithmetic_discrepancy_detected_for_meridian(package_result):
    anomalies = _find(package_result.comparison.anomalies, "arithmetic_discrepancy")
    assert len(anomalies) == 1
    anomaly = anomalies[0]
    assert anomaly.vendor_id == "meridian-electric"
    assert anomaly.detail["stated_total"] == 178950.00
    assert anomaly.detail["line_item_total"] == 181450.00
    assert anomaly.detail["delta"] == 2500.00
    assert anomaly.severity == "HIGH"


def test_no_arithmetic_discrepancy_for_vendors_whose_math_is_right(package_result):
    flagged = {a.vendor_id for a in _find(package_result.comparison.anomalies, "arithmetic_discrepancy")}
    assert "voltage-systems" not in flagged
    assert "ironclad-power" not in flagged


def test_lump_sum_bid_produces_no_arithmetic_finding():
    """Apex prices as a lump sum, so there is nothing to reconcile -- not a defect."""
    bid = NormalizedBid(
        vendor_id="apex-electrical", vendor_name="Apex", revision_label="Original",
        submitted_total=191850.00, scope={}, line_items=[],
    )
    assert check_arithmetic([bid]) == []


def test_arithmetic_tolerance_ignores_sub_cent_float_noise():
    bid = NormalizedBid(
        vendor_id="v", vendor_name="V", revision_label="Original",
        submitted_total=100000.00, scope={},
        line_items=[{"description": "a", "amount": 33333.33},
                    {"description": "b", "amount": 33333.33},
                    {"description": "c", "amount": 33333.34}],
    )
    assert check_arithmetic([bid]) == []


# --------------------------------------------------------------------------
# Drawing revision
# --------------------------------------------------------------------------

def test_stale_drawing_revision_detected_for_meridian(package_result):
    anomalies = _find(package_result.comparison.anomalies, "stale_drawing_revision")
    assert len(anomalies) == 1
    assert anomalies[0].vendor_id == "meridian-electric"
    assert anomalies[0].detail["referenced"] == "Revision 1"
    assert anomalies[0].detail["project_revision"] == "Rev 3"


def test_revision_comparison_tolerates_rev_and_revision_wording():
    """'Rev 3' and 'Revision 3' are the same drawing set, not a stale reference."""
    bid = NormalizedBid(
        vendor_id="v", vendor_name="V", revision_label="Original",
        submitted_total=1.0, scope={}, drawing_revision_referenced="Revision 3",
    )
    assert check_drawing_revision([bid], "Rev 3") == []


def test_unstated_drawing_revision_is_flagged_separately():
    bid = NormalizedBid(
        vendor_id="v", vendor_name="V", revision_label="Original",
        submitted_total=1.0, scope={}, drawing_revision_referenced=None,
    )
    anomalies = check_drawing_revision([bid], "Rev 3")
    assert _codes(anomalies) == {"drawing_revision_unstated"}


# --------------------------------------------------------------------------
# Required-scope coverage -- the finding a price comparison cannot produce
# --------------------------------------------------------------------------

def test_arc_flash_study_flagged_as_missing_from_all_bidders(package_result):
    anomalies = _find(package_result.comparison.anomalies, "required_scope_missing_all_bidders")
    assert len(anomalies) == 1
    anomaly = anomalies[0]
    assert anomaly.detail["scope_key"] == "arc_flash_study"
    assert anomaly.detail["spec_section"] == "26 05 73"
    assert anomaly.severity == "HIGH"
    assert set(anomaly.detail["statuses_by_vendor"].values()) == {"NotFound"}


def test_required_scope_covered_by_one_bidder_is_not_flagged(sample_data_dir):
    """A gap only matters when NO bidder covers it."""
    required = load_required_scope(
        sample_data_dir / "specifications" / "26-0147-div26-required-scope.json"
    )
    bids = [
        NormalizedBid(vendor_id="a", vendor_name="A", revision_label="Original",
                      submitted_total=1.0, scope={"lighting_fixtures": "Included"}),
        NormalizedBid(vendor_id="b", vendor_name="B", revision_label="Original",
                      submitted_total=1.0, scope={"lighting_fixtures": "Excluded"}),
    ]
    flagged_keys = {
        a.detail["scope_key"] for a in check_required_scope_coverage(bids, required)
    }
    assert "lighting_fixtures" not in flagged_keys


# --------------------------------------------------------------------------
# Leveling and pricing rules
# --------------------------------------------------------------------------

def test_large_leveling_delta_flags_only_voltage(package_result):
    anomalies = _find(package_result.comparison.anomalies, "large_leveling_delta")
    assert [a.vendor_id for a in anomalies] == ["voltage-systems"]
    assert anomalies[0].detail["delta_pct"] > 30


def test_pricing_outlier_rule_runs_but_does_not_fire(package_result):
    """The rule is evaluated; on this dataset nobody is >10% below median.

    A silent rule is a result, not an omission -- the system is not manufacturing
    findings to look busy.
    """
    assert "pricing_outlier_low" not in _codes(package_result.comparison.anomalies)
    submitted = sorted(v.submitted_total for v in package_result.comparison.vendors)
    median_total = (submitted[1] + submitted[2]) / 2
    lowest_pct_below = (median_total - submitted[0]) / median_total * 100
    assert lowest_pct_below < PRICING_OUTLIER_LOW_PCT


def test_unclear_scope_raises_clarification_findings(package_result):
    anomalies = _find(package_result.comparison.anomalies, "unclear_scope_requires_clarification")
    flagged = {a.vendor_id for a in anomalies}
    assert flagged == {"voltage-systems", "meridian-electric"}


def test_superseded_revision_is_informational_only(package_result):
    anomalies = _find(package_result.comparison.anomalies, "superseded_revision")
    assert len(anomalies) == 1
    assert anomalies[0].severity == "INFO"


def test_findings_are_sorted_most_severe_first(package_result):
    severities = [a.severity for a in package_result.comparison.anomalies]
    order = {"HIGH": 0, "MEDIUM": 1, "INFO": 2}
    assert severities == sorted(severities, key=lambda s: order[s])


def test_superseded_bid_is_not_evaluated_for_vendor_level_anomalies(package_result):
    """The withdrawn Ironclad original must not generate findings of its own."""
    ironclad_findings = [
        a for a in package_result.comparison.anomalies
        if a.vendor_id == "ironclad-power" and a.code != "superseded_revision"
    ]
    for finding in ironclad_findings:
        assert finding.detail.get("submitted_total", 179750.00) == 179750.00
