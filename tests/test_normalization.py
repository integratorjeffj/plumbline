"""REQ-005 / REQ-006: scope normalization onto the canonical taxonomy."""

import pytest

from src.ai.provider import ExtractionResult
from src.normalization.normalize import normalize_extraction
from src.normalization.taxonomy import SCOPE_KEYS, validate_status


def _extraction(scope: dict, base_bid: float = 100000.00) -> ExtractionResult:
    return ExtractionResult(base_bid=base_bid, scope_assertions=scope, confidence_tier="HIGH")


def test_missing_scope_keys_become_not_found():
    normalized = normalize_extraction(
        _extraction({"branch_power_rough_in": "Included"}),
        vendor_id="v", vendor_name="Vendor",
    )
    assert set(normalized.scope) == set(SCOPE_KEYS)
    # A key the model never answered is silence, not a denial.
    assert normalized.scope["arc_flash_study"] == "NotFound"
    assert normalized.scope["branch_power_rough_in"] == "Included"


def test_not_found_is_never_collapsed_into_excluded():
    normalized = normalize_extraction(
        _extraction({"arc_flash_study": "NotFound", "performance_payment_bond": "Excluded"}),
        vendor_id="v", vendor_name="Vendor",
    )
    assert normalized.scope["arc_flash_study"] == "NotFound"
    assert normalized.scope["performance_payment_bond"] == "Excluded"
    assert normalized.scope["arc_flash_study"] != normalized.scope["performance_payment_bond"]


def test_scope_keys_outside_taxonomy_are_rejected():
    with pytest.raises(ValueError, match="outside the canonical taxonomy"):
        normalize_extraction(
            _extraction({"invented_scope_item": "Included"}),
            vendor_id="v", vendor_name="Vendor",
        )


def test_invalid_scope_status_is_rejected():
    with pytest.raises(ValueError, match="Unknown scope status"):
        normalize_extraction(
            _extraction({"branch_power_rough_in": "ProbablyIncluded"}),
            vendor_id="v", vendor_name="Vendor",
        )


def test_validate_status_accepts_the_four_canonical_values():
    for status in ("Included", "Excluded", "Unclear", "NotFound"):
        assert validate_status(status) == status


def test_unclear_scope_keys_are_reported():
    normalized = normalize_extraction(
        _extraction({"temporary_power": "Unclear", "branch_power_rough_in": "Included"}),
        vendor_id="v", vendor_name="Vendor",
    )
    assert normalized.unclear_scope_keys() == ["temporary_power"]


def test_line_item_total_is_none_for_lump_sum_bids():
    normalized = normalize_extraction(_extraction({}), vendor_id="v", vendor_name="Vendor")
    assert normalized.line_item_total is None
