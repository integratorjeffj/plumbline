"""REQ-012 support: revision supersession and diffing."""

from src.comparison.revisions import apply_supersession, diff_revisions
from src.normalization.normalize import NormalizedBid


def _bid(vendor_id: str, label: str, total: float, line_items=None, scope=None) -> NormalizedBid:
    return NormalizedBid(
        vendor_id=vendor_id, vendor_name=vendor_id.title(), revision_label=label,
        submitted_total=total, scope=scope or {}, line_items=line_items or [],
    )


def test_later_revision_supersedes_earlier_submission():
    original = _bid("ironclad-power", "Original", 184300.00)
    revision = _bid("ironclad-power", "Revision 1", 179750.00)

    apply_supersession([original, revision])

    assert original.superseded_by == "Revision 1"
    assert original.is_active is False
    assert revision.is_active is True


def test_different_vendors_never_supersede_each_other():
    apex = _bid("apex-electrical", "Original", 191850.00)
    voltage = _bid("voltage-systems", "Original", 167400.00)

    apply_supersession([apex, voltage])

    assert apex.is_active is True
    assert voltage.is_active is True


def test_revision_diff_reports_total_delta(package_result):
    diffs = package_result.comparison.revision_diffs
    assert len(diffs) == 1
    diff = diffs[0]
    assert diff.vendor_id == "ironclad-power"
    assert diff.previous_total == 184300.00
    assert diff.current_total == 179750.00
    assert diff.total_delta == -4550.00


def test_revision_diff_identifies_the_changed_line_item(package_result):
    diff = package_result.comparison.revision_diffs[0]
    line_changes = [c for c in diff.changes if c.field == "line_item"]
    assert len(line_changes) == 1
    assert line_changes[0].label == "Feeders and distribution equipment"
    assert line_changes[0].delta == -4550.00


def test_diff_detects_added_and_removed_line_items():
    previous = _bid("v", "Original", 100.0, line_items=[{"description": "kept", "amount": 60.0},
                                                         {"description": "dropped", "amount": 40.0}])
    current = _bid("v", "Revision 1", 90.0, line_items=[{"description": "kept", "amount": 60.0},
                                                         {"description": "new", "amount": 30.0}])

    labels = {c.label for c in diff_revisions(previous, current).changes}
    assert "Removed: dropped" in labels
    assert "Added: new" in labels


def test_diff_detects_scope_status_changes():
    previous = _bid("v", "Original", 100.0, scope={"performance_payment_bond": "Excluded"})
    current = _bid("v", "Revision 1", 100.0, scope={"performance_payment_bond": "Included"})

    scope_changes = [c for c in diff_revisions(previous, current).changes if c.field == "scope"]
    assert len(scope_changes) == 1
    assert scope_changes[0].previous == "Excluded"
    assert scope_changes[0].current == "Included"


def test_superseded_bid_is_persisted_as_superseded(package_result):
    superseded = [b for b in package_result.bids if not b.is_active]
    assert len(superseded) == 1
    assert superseded[0].vendor_id == "ironclad-power"
    assert superseded[0].revision_label == "Original"
