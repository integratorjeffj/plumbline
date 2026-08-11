# Requirements Traceability

Concise, uniquely-identified requirements per `Architecture-Amendments-v1.0.md` Amendment 6. Extended with the provider-abstraction and provenance requirements that Amendment 1 and Amendment 3 elevate to explicit architecture decisions.

Traceability path: **Business Requirement -> Architecture -> Implementation -> Test / Evaluation -> Demo Evidence**

| ID | Requirement | Implementation | Test / Evaluation |
|---|---|---|---|
| REQ-001 | Ingest bid documents | `src/intake/email_event.py`, `src/extraction/pdf_text.py`, `src/extraction/excel_tables.py` | `tests/test_fixtures_valid.py`, `tests/test_pdf_extraction.py`, `tests/test_excel_extraction.py` |
| REQ-002 | Preserve source provenance | `src/extraction/hashing.py`, `SourceDocument` model | `tests/test_hashing.py`, `tests/test_package_golden.py` |
| REQ-003 | Match bid to project | `src/resolution/resolver.py` | `tests/test_resolution.py` |
| REQ-004 | Extract submitted total | `AIProvider.extract_bid`, `AnthropicProvider` | `tests/test_pipeline_golden.py`, `tests/test_package_golden.py` |
| REQ-005 | Normalize scope | `src/normalization/taxonomy.py`, `src/normalization/normalize.py`, `src/comparison/compare.py` | `tests/test_normalization.py`, `tests/test_comparison.py` |
| REQ-006 | Detect exclusions and unclear scope | `ScopeAssertion` status (Included/Excluded/Unclear/NotFound) | `tests/test_normalization.py`, `tests/test_comparison.py` |
| REQ-007 | Detect arithmetic discrepancies | `src/comparison/anomalies.py::check_arithmetic` | `tests/test_anomalies.py` |
| REQ-008 | Detect project-required scope missing across bidders | `src/comparison/anomalies.py::check_required_scope_coverage`, `sample-data/specifications/` | `tests/test_anomalies.py` |
| REQ-009 | Require human approval | Deferred to Milestone 3 — no review UI yet; `AIInference.review_status` is the hook | — |
| REQ-010 | Produce bid-leveling report | `src/comparison/report.py` (console); PDF/HTML deferred to Milestone 3 | `scripts/run_comparison.py` |
| REQ-011 | Simulate CRM writeback | Deferred to Milestone 3 | — |
| REQ-012 | Preserve AI inference lineage | `AIInference` model, Amendment 2 | `tests/test_pipeline_golden.py`, `tests/test_package_golden.py` |
| REQ-013 | AI operations behind an application-owned provider abstraction | `src/ai/provider.py`, `AnthropicProvider` / `FakeProvider` adapters, Amendment 1 | all pipeline tests run through `FakeProvider` |
| REQ-014 | Deterministic CI separate from live-model evaluation | `FakeProvider` in the default `pytest` run; `AnthropicProvider` only on explicit live runs, Amendment 4 | `tests/` vs. `python scripts/run_comparison.py` |
| REQ-015 | Confidence expressed as HIGH / REVIEW / LOW, not invented percentages | `ExtractionResult.__post_init__` rejects anything else | `tests/test_package_golden.py` |
| REQ-016 | Track bid revisions and summarize material changes | `src/comparison/revisions.py` | `tests/test_revisions.py` |
| REQ-017 | Adjusted pricing must use estimator-entered values, never AI-derived | `src/comparison/adjustments.py` (refuses any file not marked `estimator_entered`) | `tests/test_comparison.py` |
| REQ-018 | Never price scope carried by another bid package | `taxonomy.ScopeItem.in_package_scope`, enforced in `adjustments.load_adjustments` | `tests/test_comparison.py` |

## Out of scope until Milestone 3

REQ-009 (human approval UI), REQ-010 (formatted report artifact), and REQ-011 (CRM writeback)
require a review surface that does not exist yet. They are tracked here so later milestones
check off against the same ID rather than re-deriving requirements.
