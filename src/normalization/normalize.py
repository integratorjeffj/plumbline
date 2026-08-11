"""Normalize a raw AI extraction into a comparable bid record.

Turns one vendor's `ExtractionResult` into a `NormalizedBid` whose scope keys
are guaranteed to cover the full canonical taxonomy. This is where "the vendor
never mentioned it" becomes an explicit `NotFound` rather than a missing
dictionary key -- downstream comparison can then assume every bid answers every
scope item, which is what makes a complete matrix (and the missing-scope
analysis) possible.

Normalization is deliberately deterministic. The AI already did the hard part
(reading prose and deciding what a sentence means); mapping its answer onto a
fixed vocabulary and filling gaps is ordinary code.
"""

from dataclasses import dataclass, field

from src.ai.provider import ExtractionResult
from src.normalization.taxonomy import NOT_FOUND, SCOPE_KEYS, validate_status


@dataclass
class NormalizedBid:
    vendor_id: str
    vendor_name: str
    revision_label: str
    submitted_total: float
    scope: dict[str, str]
    line_items: list[dict] = field(default_factory=list)
    allowances: list[dict] = field(default_factory=list)
    alternates: list[dict] = field(default_factory=list)
    citations: dict[str, dict] = field(default_factory=dict)
    drawing_revision_referenced: str | None = None
    confidence_tier: str = "REVIEW"
    source_document_filename: str = ""
    bid_id: str = ""
    superseded_by: str | None = None

    @property
    def is_active(self) -> bool:
        """False once a later revision supersedes this submission."""
        return self.superseded_by is None

    @property
    def line_item_total(self) -> float | None:
        if not self.line_items:
            return None
        return round(sum(item["amount"] for item in self.line_items), 2)

    def status_for(self, scope_key: str) -> str:
        return self.scope.get(scope_key, NOT_FOUND)

    def unclear_scope_keys(self) -> list[str]:
        """Scope items needing a clarification request rather than a dollar assumption."""
        return [key for key in SCOPE_KEYS if self.scope.get(key) == "Unclear"]


def normalize_extraction(
    extraction: ExtractionResult,
    vendor_id: str,
    vendor_name: str,
    revision_label: str = "Original",
    source_document_filename: str = "",
    bid_id: str = "",
) -> NormalizedBid:
    scope: dict[str, str] = {}
    for key in SCOPE_KEYS:
        raw_status = extraction.scope_assertions.get(key, NOT_FOUND)
        scope[key] = validate_status(raw_status)

    unknown_keys = set(extraction.scope_assertions) - set(SCOPE_KEYS)
    if unknown_keys:
        raise ValueError(
            f"Extraction for {vendor_name} returned scope keys outside the canonical taxonomy: "
            f"{sorted(unknown_keys)}. Add them to src/normalization/taxonomy.py or fix the prompt -- "
            "the model must map onto the taxonomy, not invent categories."
        )

    return NormalizedBid(
        vendor_id=vendor_id,
        vendor_name=vendor_name,
        revision_label=revision_label,
        submitted_total=extraction.base_bid,
        scope=scope,
        line_items=list(extraction.line_items),
        allowances=list(extraction.allowances),
        alternates=list(extraction.alternates),
        citations=dict(extraction.citations),
        drawing_revision_referenced=extraction.drawing_revision_referenced,
        confidence_tier=extraction.confidence_tier,
        source_document_filename=source_document_filename,
        bid_id=bid_id,
    )
