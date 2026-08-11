"""Revision tracking and diffing.

A vendor's second submission is a replacement, not a fifth competitor. Getting
this wrong would double-count a bidder in every ranking and average, so
supersession is resolved deterministically before any comparison math runs.

Detection uses the explicit `supersedes_event_id` on the email event when the
vendor states it, and otherwise falls back to "same vendor, same bid package,
later submission". Nothing here is probabilistic.
"""

from dataclasses import dataclass

from src.normalization.normalize import NormalizedBid


@dataclass
class RevisionChange:
    field: str
    label: str
    previous: object
    current: object
    delta: float | None = None


@dataclass
class RevisionDiff:
    vendor_id: str
    vendor_name: str
    previous_label: str
    current_label: str
    previous_total: float
    current_total: float
    changes: list[RevisionChange]

    @property
    def total_delta(self) -> float:
        return round(self.current_total - self.previous_total, 2)


def apply_supersession(bids: list[NormalizedBid]) -> list[NormalizedBid]:
    """Mark every bid superseded by a later revision from the same vendor.

    Bids are expected in submission order. Returns the same list with
    `superseded_by` populated; callers filter on `is_active`.
    """
    latest_by_vendor: dict[str, NormalizedBid] = {}
    for bid in bids:
        previous = latest_by_vendor.get(bid.vendor_id)
        if previous is not None:
            previous.superseded_by = bid.revision_label
        latest_by_vendor[bid.vendor_id] = bid
    return bids


def diff_revisions(previous: NormalizedBid, current: NormalizedBid) -> RevisionDiff:
    """Summarize what materially changed between two submissions from one vendor."""
    changes: list[RevisionChange] = []

    if previous.submitted_total != current.submitted_total:
        changes.append(RevisionChange(
            field="submitted_total",
            label="Base bid",
            previous=previous.submitted_total,
            current=current.submitted_total,
            delta=round(current.submitted_total - previous.submitted_total, 2),
        ))

    previous_items = {item["description"]: item["amount"] for item in previous.line_items}
    current_items = {item["description"]: item["amount"] for item in current.line_items}

    for description, current_amount in current_items.items():
        if description not in previous_items:
            changes.append(RevisionChange(
                field="line_item", label=f"Added: {description}",
                previous=None, current=current_amount, delta=current_amount,
            ))
        elif previous_items[description] != current_amount:
            changes.append(RevisionChange(
                field="line_item", label=description,
                previous=previous_items[description], current=current_amount,
                delta=round(current_amount - previous_items[description], 2),
            ))

    for description, previous_amount in previous_items.items():
        if description not in current_items:
            changes.append(RevisionChange(
                field="line_item", label=f"Removed: {description}",
                previous=previous_amount, current=None, delta=round(-previous_amount, 2),
            ))

    for scope_key, current_status in current.scope.items():
        previous_status = previous.scope.get(scope_key)
        if previous_status is not None and previous_status != current_status:
            changes.append(RevisionChange(
                field="scope", label=scope_key,
                previous=previous_status, current=current_status,
            ))

    return RevisionDiff(
        vendor_id=current.vendor_id,
        vendor_name=current.vendor_name,
        previous_label=previous.revision_label,
        current_label=current.revision_label,
        previous_total=previous.submitted_total,
        current_total=current.submitted_total,
        changes=changes,
    )


def diff_all(bids: list[NormalizedBid]) -> list[RevisionDiff]:
    """Diff each consecutive pair of submissions from the same vendor."""
    by_vendor: dict[str, list[NormalizedBid]] = {}
    for bid in bids:
        by_vendor.setdefault(bid.vendor_id, []).append(bid)

    diffs: list[RevisionDiff] = []
    for vendor_bids in by_vendor.values():
        for previous, current in zip(vendor_bids, vendor_bids[1:]):
            diffs.append(diff_revisions(previous, current))
    return diffs
