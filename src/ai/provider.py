"""Application-owned AI provider contract (Amendment 1).

Business logic depends only on this module, never on a vendor SDK
directly. `AnthropicProvider` is the first implementation; a future
`OpenAIProvider` or `GeminiProvider` can be added without touching
src/pipeline.py.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from src.extraction.pdf_text import PageText

CONFIDENCE_TIERS = ("HIGH", "REVIEW", "LOW")


@dataclass(frozen=True)
class ExtractionResult:
    """Structured output of the extract_bid AI operation.

    This is AI Interpretation, not Source Truth -- it must always travel
    with a provider/model/prompt_version and a confidence tier so it can be
    stored as an AIInference lineage record (Amendment 2), never silently
    merged into Bid as if it were vendor-submitted fact.

    `base_bid` is the total the vendor STATES. `line_items` are what the vendor
    broke out. They are kept separate rather than reconciled here because the
    gap between them is a finding the comparison engine reports, not an error
    the extractor should quietly fix.
    """

    base_bid: float
    line_items: list[dict] = field(default_factory=list)
    allowances: list[dict] = field(default_factory=list)
    alternates: list[dict] = field(default_factory=list)
    scope_assertions: dict[str, str] = field(default_factory=dict)
    citations: dict[str, dict] = field(default_factory=dict)
    drawing_revision_referenced: str | None = None
    confidence_tier: str = "REVIEW"
    provider: str = ""
    model: str = ""
    raw_output: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.confidence_tier not in CONFIDENCE_TIERS:
            raise ValueError(
                f"confidence_tier must be one of {CONFIDENCE_TIERS}, got {self.confidence_tier!r}. "
                "Numeric confidence percentages are not permitted -- see docs/architecture-review.md Section 2."
            )

    def as_schema_payload(self) -> dict:
        """The subset validated against schemas/bid.schema.json."""
        return {
            "base_bid": self.base_bid,
            "line_items": self.line_items,
            "allowances": self.allowances,
            "alternates": self.alternates,
            "scope_assertions": self.scope_assertions,
            "drawing_revision_referenced": self.drawing_revision_referenced,
            "citations": self.citations,
            "confidence_tier": self.confidence_tier,
        }

    @property
    def line_item_total(self) -> float:
        return round(sum(item["amount"] for item in self.line_items), 2)


class AIProvider(ABC):
    """Contract every AI provider adapter implements."""

    provider_name: str
    model_name: str

    @abstractmethod
    def extract_bid(
        self,
        pages: list[PageText],
        prompt_version: str,
        email_body: str = "",
        document_key: str = "",
    ) -> ExtractionResult:
        """Extract structured bid facts from page-aware source text.

        `email_body` matters because some vendors put their pricing in the
        message rather than the attachment; the model must read both together.
        `document_key` identifies which document is being extracted, which
        deterministic adapters use to look up a recorded response.
        """
        raise NotImplementedError
