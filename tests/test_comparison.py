"""REQ-005: bid leveling, adjusted pricing, and the comparison matrix."""

import json

import pytest

from src.comparison.adjustments import load_adjustments
from src.comparison.compare import build_comparison, compute_adjustments
from src.normalization.taxonomy import SCOPE_KEYS


@pytest.fixture
def adjustment_set(sample_data_dir):
    return load_adjustments(sample_data_dir / "adjustments" / "26-0147-BP-26.json")


def _vendor(comparison, vendor_id):
    return next(v for v in comparison.vendors if v.vendor_id == vendor_id)


def test_only_active_bids_are_compared(package_result):
    comparison = package_result.comparison
    assert len(comparison.vendors) == 4
    # Ironclad appears once, as its latest revision -- not twice.
    ironclad = [v for v in comparison.vendors if v.vendor_id == "ironclad-power"]
    assert len(ironclad) == 1
    assert ironclad[0].revision_label == "Revision 1"
    assert ironclad[0].submitted_total == 179750.00


def test_submitted_ranking_matches_raw_price_order(package_result):
    ranked = package_result.comparison.by_submitted_rank()
    assert [v.vendor_id for v in ranked] == [
        "voltage-systems", "meridian-electric", "ironclad-power", "apex-electrical",
    ]


def test_adjusted_ranking_inverts_the_cheapest_bidder(package_result):
    ranked = package_result.comparison.by_adjusted_rank()
    assert [v.vendor_id for v in ranked] == [
        "ironclad-power", "meridian-electric", "apex-electrical", "voltage-systems",
    ]


def test_leveling_changes_the_recommendation(package_result):
    comparison = package_result.comparison
    assert comparison.leveling_changes_the_answer is True
    assert comparison.lowest_submitted.vendor_id == "voltage-systems"
    assert comparison.lowest_adjusted.vendor_id == "ironclad-power"


def test_adjusted_totals_are_exact(package_result):
    comparison = package_result.comparison
    assert _vendor(comparison, "voltage-systems").adjusted_total == 223700.00
    assert _vendor(comparison, "meridian-electric").adjusted_total == 188550.00
    assert _vendor(comparison, "ironclad-power").adjusted_total == 186250.00
    assert _vendor(comparison, "apex-electrical").adjusted_total == 201450.00


def test_bidder_including_bond_receives_no_bond_adjustment(package_result):
    ironclad = _vendor(package_result.comparison, "ironclad-power")
    adjusted_keys = {a.scope_key for a in ironclad.adjustments}
    assert "performance_payment_bond" not in adjusted_keys
    # Only the universally-missing arc-flash study applies to Ironclad.
    assert adjusted_keys == {"arc_flash_study"}


def test_unclear_scope_is_not_priced_as_an_adjustment(package_result):
    """An ambiguous item is a clarification to send, not a cost to assume."""
    meridian = _vendor(package_result.comparison, "meridian-electric")
    assert "temporary_power" in meridian.unclear_scope_keys
    assert "temporary_power" not in {a.scope_key for a in meridian.adjustments}


def test_out_of_package_exclusions_are_never_priced(package_result):
    comparison = package_result.comparison
    assert set(comparison.out_of_package_scope_keys) == {
        "utility_company_charges", "structured_cabling_div27", "security_access_control_div28",
    }
    for vendor in comparison.vendors:
        for adjustment in vendor.adjustments:
            assert adjustment.scope_key not in comparison.out_of_package_scope_keys


def test_scope_matrix_covers_every_taxonomy_item_for_every_bidder(package_result):
    comparison = package_result.comparison
    assert set(comparison.scope_matrix) == set(SCOPE_KEYS)
    for scope_key, row in comparison.scope_matrix.items():
        assert set(row) == {v.vendor_id for v in comparison.vendors}


def test_rank_movement_reports_direction(package_result):
    comparison = package_result.comparison
    assert _vendor(comparison, "voltage-systems").rank_movement == -3
    assert _vendor(comparison, "ironclad-power").rank_movement == 2


def test_adjustments_must_declare_estimator_provenance(tmp_path, sample_data_dir):
    """An AI-derived adjustment file must be refused, not silently trusted."""
    raw = json.loads((sample_data_dir / "adjustments" / "26-0147-BP-26.json").read_text(encoding="utf-8"))
    raw["source"] = "ai_suggested"
    bad_path = tmp_path / "bad_adjustments.json"
    bad_path.write_text(json.dumps(raw), encoding="utf-8")

    with pytest.raises(ValueError, match="estimator_entered"):
        load_adjustments(bad_path)


def test_adjustment_for_out_of_package_scope_is_refused(tmp_path, sample_data_dir):
    raw = json.loads((sample_data_dir / "adjustments" / "26-0147-BP-26.json").read_text(encoding="utf-8"))
    raw["adjustments"].append({
        "scope_key": "structured_cabling_div27",
        "applies_when_status": ["Excluded"],
        "amount": 10000.00,
        "rationale": "Should be rejected -- Division 27 is another package's budget.",
    })
    bad_path = tmp_path / "double_count.json"
    bad_path.write_text(json.dumps(raw), encoding="utf-8")

    with pytest.raises(ValueError, match="double-count"):
        load_adjustments(bad_path)


def test_build_comparison_requires_at_least_one_active_bid(adjustment_set):
    with pytest.raises(ValueError, match="no active bids"):
        build_comparison([], adjustment_set, "26-0147", "26-0147-BP-26", 185000.00)
