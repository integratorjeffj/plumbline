"""Deterministic recorded-response provider.

Used by the default `pytest` run and offline `--fake` slice runs so
software CI never depends on a live model call, per Amendment 4. This is
NOT a model-quality evaluation -- it exercises everything downstream of
extraction (schema validation, persistence, citations, pipeline wiring)
with a fixed response that a correct read of the Apex proposal would
produce. Live extraction accuracy is a separate, explicitly-triggered
concern (see eval/run_eval.py run against AnthropicProvider).
"""

from src.ai.provider import AIProvider, ExtractionResult
from src.extraction.pdf_text import PageText

_APEX_RESPONSE = ExtractionResult(
    base_bid=191850.00,
    allowances=[
        {"name": "Lighting fixture allowance", "amount": 42500.00, "included_in_base_bid": True},
    ],
    alternates=[
        {"id": "A1", "amount": 8750.00, "included_in_base_bid": False},
    ],
    scope_assertions={
        "electrical_permit_fees": "Included",
        "performance_payment_bond": "Excluded",
        "arc_flash_study": "NotFound",
    },
    citations={
        "base_bid": {"page": 1, "section": "Proposal Summary"},
        "lighting_fixture_allowance": {"page": 3, "section": "Allowances"},
        "alternate_a1": {"page": 3, "section": "Alternates"},
        "performance_payment_bond": {"page": 4, "section": "Clarifications and Exclusions"},
        "electrical_permit_fees": {"page": 2, "section": "Scope of Work"},
    },
    confidence_tier="HIGH",
    provider="fake",
    model="fake-recorded-v1",
    raw_output={"note": "Fixed recorded response for the Apex Electrical fixture."},
)


class FakeProvider(AIProvider):
    provider_name = "fake"
    model_name = "fake-recorded-v1"

    def extract_bid(self, pages: list[PageText], prompt_version: str) -> ExtractionResult:
        # Deliberately ignores `pages` -- this provider proves the pipeline
        # plumbing, not extraction accuracy against arbitrary input.
        return _APEX_RESPONSE
