# Requirements Traceability

Concise, uniquely-identified requirements per `Architecture-Amendments-v1.0.md` Amendment 6. Extended with the provider-abstraction and provenance requirements that Amendment 1 and Amendment 3 elevate to explicit architecture decisions.

Traceability path: **Business Requirement -> Architecture -> Implementation -> Test / Evaluation -> Demo Evidence**

| ID | Requirement | Implementation (Milestone 1) | Test / Evaluation |
|---|---|---|---|
| REQ-001 | Ingest bid documents | `src/intake/email_event.py`, `scripts/run_slice.py` step 1-2 | `tests/test_fixtures_valid.py` |
| REQ-002 | Preserve source provenance | `src/extraction/hashing.py`, `SourceDocument` model | `tests/test_hashing.py` |
| REQ-003 | Match bid to project | `src/resolution/resolver.py` | `tests/test_resolution.py` |
| REQ-004 | Extract submitted total | `src/ai/provider.py::extract_bid`, `AnthropicProvider` | `tests/test_pipeline_golden.py` (base_bid) |
| REQ-005 | Normalize scope | Deferred beyond Milestone 1 (single-vendor slice has no cross-vendor normalization) | — |
| REQ-006 | Detect exclusions and unclear scope | `ScopeAssertion` status field (Included/Excluded/Unclear/NotFound) | `tests/test_pipeline_golden.py` (scope_assertions) |
| REQ-007 | Detect arithmetic discrepancies | Deferred — Apex fixture has no planted arithmetic error (see `Apex-Electrical-First-Fixture-v0.1.md`); exercised later against Meridian's fixture | — |
| REQ-008 | Detect project-required scope missing across bidders | Deferred — requires the 4-vendor comparison (Milestone 2) | `arc_flash_study: NotFound` is captured now as a precondition |
| REQ-009 | Require human approval | Deferred — no review UI in this milestone; `AIInference.review_status` field exists as the hook | — |
| REQ-010 | Produce bid-leveling report | Deferred to Milestone 3 | — |
| REQ-011 | Simulate CRM writeback | Deferred to Milestone 3 | — |
| REQ-012 | Preserve AI inference lineage | `AIInference` model (`src/persistence/models.py`), Amendment 2 | `tests/test_pipeline_golden.py` (AIInference row asserted) |
| REQ-013 | AI operations behind an application-owned provider abstraction | `src/ai/provider.py` protocol, `AnthropicProvider` / `FakeProvider` adapters, Amendment 1 | `tests/test_pipeline_golden.py` (uses `FakeProvider`) |
| REQ-014 | Deterministic CI separate from live-model evaluation | `FakeProvider` used in the default `pytest` run; `AnthropicProvider` only exercised via explicit live run, Amendment 4 | `tests/test_pipeline_golden.py` vs. manual `python scripts/run_slice.py` |
| REQ-015 | Confidence expressed as HIGH / REVIEW / LOW, not invented percentages | `AIInference.confidence_tier` | `tests/test_pipeline_golden.py` |

## Out of scope for Milestone 1

REQ-005, REQ-007 (against Apex specifically), REQ-008 (full cross-vendor check), REQ-009 (UI), REQ-010, REQ-011 all require either multiple vendors or a review/reporting surface that does not exist yet. They are tracked here so later milestones can be checked off against the same ID rather than re-derived.
