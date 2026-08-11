"""Deterministic recorded-response provider.

Used by the default `pytest` run and offline `--fake` runs so software CI never
depends on a live model call, per Amendment 4. This is NOT a model-quality
evaluation -- it exercises everything downstream of extraction (schema
validation, normalization, comparison, anomaly rules, persistence, citations)
with fixed responses that a correct read of each fixture would produce. Live
extraction accuracy is a separate, explicitly-triggered concern.

Responses are keyed by document filename. Asking for an unrecorded document
raises rather than silently returning something plausible -- a fixture without
a recorded response is a gap in the test data, and it should fail loudly.
"""

from src.ai.provider import AIProvider, ExtractionResult
from src.extraction.pdf_text import PageText

# Every bidder is silent on the arc-flash study and excludes the three scope
# items carried by other bid packages. Shared here so the per-vendor tables
# below show only what actually differentiates them.
_COMMON = {
    "arc_flash_study": "NotFound",
    "utility_company_charges": "Excluded",
    "structured_cabling_div27": "Excluded",
    "security_access_control_div28": "Excluded",
}

_IRONCLAD_SCOPE = {
    "electrical_mobilization_supervision": "Included",
    "branch_power_rough_in": "Included",
    "lighting_branch_circuitry": "Included",
    "lighting_fixtures": "Included",
    "electrical_permit_fees": "Included",
    "temporary_power": "Included",
    "fire_alarm_device_connections": "Included",
    "feeder_branch_circuit_testing": "Included",
    "closeout_documentation": "Included",
    "performance_payment_bond": "Included",
    **_COMMON,
}

_IRONCLAD_CITATIONS = {
    "base_bid": {"page": 1, "section": "Proposal Summary"},
    "lighting_fixture_allowance": {"page": 2, "section": "Pricing Detail"},
    "performance_payment_bond": {"page": 3, "section": "Included Scope"},
    "electrical_permit_fees": {"page": 3, "section": "Included Scope"},
    "drawing_revision_referenced": {"page": 1, "section": "Proposal Summary"},
}


def _ironclad_line_items(feeders_amount: float) -> list[dict]:
    return [
        {"description": "Mobilization, supervision, and project management", "amount": 13200.00},
        {"description": "Branch power rough-in", "amount": 55900.00},
        {"description": "Feeders and distribution equipment", "amount": feeders_amount},
        {"description": "Lighting branch circuitry", "amount": 21750.00},
        {"description": "Lighting fixture allowance", "amount": 41000.00},
        {"description": "Fire alarm device connections", "amount": 3000.00},
        {"description": "Temporary power for Ironclad work", "amount": 1800.00},
        {"description": "Closeout documentation", "amount": 2000.00},
        {"description": "Performance and payment bond", "amount": 1100.00},
    ]


RECORDED_RESPONSES: dict[str, ExtractionResult] = {
    # ---------------- Apex: strongest scope, highest price, lump sum ----------------
    "apex_electrical_proposal.pdf": ExtractionResult(
        base_bid=191850.00,
        line_items=[],  # Apex prices as a lump sum; no breakdown to sum against.
        allowances=[
            {"name": "Lighting fixture allowance", "amount": 42500.00, "included_in_base_bid": True},
        ],
        alternates=[
            {"id": "A1", "amount": 8750.00, "included_in_base_bid": False},
        ],
        scope_assertions={
            "electrical_mobilization_supervision": "Included",
            "branch_power_rough_in": "Included",
            "lighting_branch_circuitry": "Included",
            "lighting_fixtures": "Included",
            "electrical_permit_fees": "Included",
            "temporary_power": "Included",
            "fire_alarm_device_connections": "Included",
            "feeder_branch_circuit_testing": "Included",
            "closeout_documentation": "Included",
            "performance_payment_bond": "Excluded",
            **_COMMON,
        },
        citations={
            "base_bid": {"page": 1, "section": "Proposal Summary"},
            "lighting_fixture_allowance": {"page": 3, "section": "Allowances"},
            "alternate_a1": {"page": 3, "section": "Alternates"},
            "performance_payment_bond": {"page": 4, "section": "Clarifications and Exclusions"},
            "electrical_permit_fees": {"page": 2, "section": "Scope of Work"},
            "drawing_revision_referenced": {"page": 4, "section": "Clarifications and Exclusions"},
        },
        drawing_revision_referenced="Revision 3",
        confidence_tier="HIGH",
        provider="fake",
        model="fake-recorded-v1",
        raw_output={"note": "Recorded response for the Apex Electrical fixture."},
    ),

    # ---------------- Voltage: lowest submitted, two material exclusions ----------------
    "voltage_systems_pricing.xlsx": ExtractionResult(
        base_bid=167400.00,
        line_items=[
            {"description": "Mobilization, supervision, and project management", "amount": 12800.00},
            {"description": "Branch power rough-in - all areas per drawings", "amount": 61200.00},
            {"description": "Feeders and distribution equipment", "amount": 42000.00},
            {"description": "Lighting branch circuitry", "amount": 34500.00},
            {"description": "Fire alarm device connections (electrical drawings)", "amount": 9400.00},
            {"description": "Temporary power for Voltage Systems work", "amount": 4900.00},
            {"description": "Closeout documentation and as-built markups", "amount": 2600.00},
        ],
        allowances=[],
        alternates=[],
        scope_assertions={
            "electrical_mobilization_supervision": "Included",
            "branch_power_rough_in": "Included",
            "lighting_branch_circuitry": "Included",
            "lighting_fixtures": "Excluded",
            "electrical_permit_fees": "Excluded",
            "temporary_power": "Included",
            "fire_alarm_device_connections": "Included",
            # "Testing limited to standard continuity checks. Commissioning scope
            # to be confirmed" -- mentioned but not resolvable either way.
            "feeder_branch_circuit_testing": "Unclear",
            "closeout_documentation": "Included",
            "performance_payment_bond": "Excluded",
            **_COMMON,
        },
        citations={
            "base_bid": {"page": 1, "section": "Bid Summary"},
            "line_items": {"page": 2, "section": "Pricing Detail"},
            "lighting_fixtures": {"page": 3, "section": "Exclusions"},
            "electrical_permit_fees": {"page": 3, "section": "Exclusions"},
            "performance_payment_bond": {"page": 3, "section": "Exclusions"},
            "feeder_branch_circuit_testing": {"page": 4, "section": "Notes"},
            "drawing_revision_referenced": {"page": 4, "section": "Notes"},
        },
        drawing_revision_referenced="Revision 3",
        confidence_tier="REVIEW",
        provider="fake",
        model="fake-recorded-v1",
        raw_output={"note": "Recorded response for the Voltage Systems fixture."},
    ),

    # ---------------- Meridian: arithmetic discrepancy + stale drawing revision ----------------
    "meridian_electric_scope_letter.pdf": ExtractionResult(
        # Stated total from the email body. Line items below sum to $181,450.00,
        # a $2,500.00 gap. Recorded as the vendor stated it -- reconciling it is
        # the comparison engine's job, not the extractor's.
        base_bid=178950.00,
        line_items=[
            {"description": "Mobilization, supervision, and project management", "amount": 11500.00},
            {"description": "Branch power rough-in", "amount": 63800.00},
            {"description": "Feeders and distribution equipment", "amount": 40200.00},
            {"description": "Lighting branch circuitry", "amount": 22950.00},
            {"description": "Lighting fixture allowance", "amount": 38000.00},
            {"description": "Fire alarm device connections", "amount": 3200.00},
            {"description": "Closeout documentation", "amount": 1800.00},
        ],
        allowances=[
            {"name": "Lighting fixture allowance", "amount": 38000.00, "included_in_base_bid": True},
        ],
        alternates=[],
        scope_assertions={
            "electrical_mobilization_supervision": "Included",
            "branch_power_rough_in": "Included",
            "lighting_branch_circuitry": "Included",
            "lighting_fixtures": "Included",
            "electrical_permit_fees": "Included",
            # "Temporary power requirements will be coordinated with the general
            # contractor" -- says who will discuss it, not who pays for it.
            "temporary_power": "Unclear",
            "fire_alarm_device_connections": "Included",
            "feeder_branch_circuit_testing": "Included",
            "closeout_documentation": "Included",
            "performance_payment_bond": "Excluded",
            **_COMMON,
        },
        citations={
            "base_bid": {"page": 1, "section": "Email body - pricing"},
            "line_items": {"page": 1, "section": "Email body - pricing"},
            "lighting_fixture_allowance": {"page": 1, "section": "Included Scope"},
            "electrical_permit_fees": {"page": 1, "section": "Included Scope"},
            "performance_payment_bond": {"page": 2, "section": "Exclusions"},
            "temporary_power": {"page": 2, "section": "Clarifications"},
            "drawing_revision_referenced": {"page": 1, "section": "Scope Letter"},
        },
        drawing_revision_referenced="Revision 1",
        confidence_tier="REVIEW",
        provider="fake",
        model="fake-recorded-v1",
        raw_output={"note": "Recorded response for the Meridian Electric fixture."},
    ),

    # ---------------- Ironclad: original, superseded by Rev 1 ----------------
    "ironclad_power_proposal.pdf": ExtractionResult(
        base_bid=184300.00,
        line_items=_ironclad_line_items(44550.00),
        allowances=[
            {"name": "Lighting fixture allowance", "amount": 41000.00, "included_in_base_bid": True},
        ],
        alternates=[],
        scope_assertions=dict(_IRONCLAD_SCOPE),
        citations=dict(_IRONCLAD_CITATIONS),
        drawing_revision_referenced="Revision 3",
        confidence_tier="HIGH",
        provider="fake",
        model="fake-recorded-v1",
        raw_output={"note": "Recorded response for the Ironclad original proposal."},
    ),

    # ---------------- Ironclad Rev 1: generator feeder deleted per Addendum 2 ----------------
    "ironclad_power_proposal_rev1.pdf": ExtractionResult(
        base_bid=179750.00,
        line_items=_ironclad_line_items(40000.00),
        allowances=[
            {"name": "Lighting fixture allowance", "amount": 41000.00, "included_in_base_bid": True},
        ],
        alternates=[],
        scope_assertions=dict(_IRONCLAD_SCOPE),
        citations=dict(_IRONCLAD_CITATIONS),
        drawing_revision_referenced="Revision 3",
        confidence_tier="HIGH",
        provider="fake",
        model="fake-recorded-v1",
        raw_output={"note": "Recorded response for the Ironclad Revision 1 proposal."},
    ),
}


class FakeProvider(AIProvider):
    provider_name = "fake"
    model_name = "fake-recorded-v1"

    def extract_bid(
        self,
        pages: list[PageText],
        prompt_version: str,
        email_body: str = "",
        document_key: str = "",
    ) -> ExtractionResult:
        # Deliberately ignores `pages` and `email_body` -- this provider proves
        # the pipeline plumbing, not extraction accuracy against arbitrary input.
        if document_key not in RECORDED_RESPONSES:
            raise KeyError(
                f"No recorded FakeProvider response for document {document_key!r}. "
                f"Known documents: {sorted(RECORDED_RESPONSES)}. "
                "Add a recorded response in src/ai/fake_provider.py before running this fixture offline."
            )
        return RECORDED_RESPONSES[document_key]
