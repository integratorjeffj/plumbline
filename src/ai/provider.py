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
    """

    base_bid: float
    allowances: list[dict] = field(default_factory=list)
    alternates: list[dict] = field(default_factory=list)
    scope_assertions: dict[str, str] = field(default_factory=dict)
    citations: dict[str, dict] = field(default_factory=dict)
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


class AIProvider(ABC):
    """Contract every AI provider adapter implements."""

    provider_name: str
    model_name: str

    @abstractmethod
    def extract_bid(self, pages: list[PageText], prompt_version: str) -> ExtractionResult:
        """Extract structured bid facts (base bid, allowances, alternates,
        scope assertions, citations) from page-aware source text."""
        raise NotImplementedError
