# Bid Intelligence & Procurement Copilot

An AI-assisted procurement and bid-leveling platform for construction subcontractor bids —
currently at **Milestone 2: Intelligence**, built against a fully synthetic demo company and a
four-vendor bid package.

This repository is a portfolio demonstration. All companies, people, prices, and documents
are fictional (see `docs/company-profile.md`).

## What it does

Four subcontractors bid the same electrical package in four different formats — a PDF, an
Excel workbook, pricing typed into an email body, and a PDF that gets revised after an
addendum. The system extracts all of them, levels the scope, and produces this:

```
  Vendor                               Submitted  Rank      Adjusted  Rank   Move
  ------------------------------------------------------------------------------
  Voltage Systems Inc.                  $167,400     1      $223,700     4     -3
  Meridian Electric & Controls          $178,950     2      $188,550     2      -
  Ironclad Power & Electric             $179,750     3      $186,250     1     +2
  Apex Electrical Contractors           $191,850     4      $201,450     3     +1

  *** The cheapest submitted bid is NOT the best value.
```

It also finds what no side-by-side price comparison can: the **arc-flash study required by
specification 26 05 73 that none of the four bidders addressed**. Plus a $2,500 arithmetic
error in one bid, a proposal priced against superseded drawings, and a revision that
supersedes an earlier submission.

## Run it

```bash
python -m venv .venv
.venv/Scripts/activate       # or: source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt

python scripts/run_comparison.py --fake   # full four-vendor comparison, offline
python scripts/run_slice.py --fake        # single-vendor extraction slice, offline
python scripts/run_comparison.py          # live Claude extraction (requires ANTHROPIC_API_KEY)
```

`--fake` uses a recorded response (`src/ai/fake_provider.py`) so the whole pipeline —
hashing, PDF extraction, resolution, schema validation, persistence, citations — can be
proven out and unit-tested with zero network calls and zero API cost. Dropping
`ANTHROPIC_API_KEY` into a local `.env` (copy `.env.example`) switches the same command to a
live Claude call with no code changes.

## Tests

```bash
python -m pytest
```

75 deterministic tests, all running against `FakeProvider` — no live model call is part of
the default test run, by design (`docs/architecture-amendments.md` Amendment 4: software CI
stays deterministic; live-model evaluation is a separate, explicitly-triggered concern).

Because every fixture is authored here, the correct answer is known before extraction runs.
`eval/golden/` holds those answer keys and `eval/run_eval.py` checks output against them —
55 assertions on the package comparison alone, covering rankings, adjusted totals, the scope
matrix, revision diffs, and every expected anomaly.

## Design decisions worth noting

- **AI reads; code decides.** The model classifies scope language and pulls figures out of
  prose. Every ranking, sum, and anomaly rule is deterministic Python. See the AI
  responsibility matrix in `docs/architecture-review.md` Section 4.
- **`NotFound` never collapses into `Excluded`.** "The vendor said no" and "the proposal is
  silent" carry different risk, and conflating them would erase the arc-flash finding.
- **Adjustment dollar values are estimator-entered, never AI-derived.** The loader refuses any
  adjustment file not marked `estimator_entered`.
- **Confidence is `HIGH` / `REVIEW` / `LOW`.** Numeric percentages imply a calibration that
  does not exist; `ExtractionResult` rejects them outright.
- **Stated totals are never silently repaired.** Meridian's line items do not sum to its stated
  total, and preserving that gap is what makes the discrepancy detectable.

## Governing documents

Read in this order of precedence (see `docs/architecture-amendments.md` for the full rule):

1. [`docs/architecture-amendments.md`](docs/architecture-amendments.md) — approved amendments to the architecture review
2. [`docs/architecture-review.md`](docs/architecture-review.md) — Principal Architect review, tech stack, 8-phase plan
3. [`docs/charter.md`](docs/charter.md) — original product vision/concept
4. [`docs/demo-scenario.md`](docs/demo-scenario.md) — the four-vendor scenario and every planted defect
5. [`docs/company-profile.md`](docs/company-profile.md) and [`docs/fixtures/apex-electrical-fixture-spec.md`](docs/fixtures/apex-electrical-fixture-spec.md) — synthetic demo facts
6. [`docs/requirements.md`](docs/requirements.md) — requirement IDs, traced to implementation and tests

## Project layout

```
docs/            governing documents, demo scenario, requirements traceability
sample-data/     synthetic company/project/vendor records, emails, bid documents,
                 specifications, estimator-entered adjustments
schemas/         Demo Schema v1.0 (also used as the Claude tool input_schema)
src/
  config.py      environment loading (ANTHROPIC_API_KEY, DB path)
  intake/        email event loading (body text is a first-class pricing source)
  extraction/    SHA-256 hashing, page-aware PDF and Excel extraction
  resolution/    deterministic project/vendor/bid-package matching
  ai/            AIProvider abstraction: FakeProvider + AnthropicProvider, versioned prompts
  normalization/ canonical scope taxonomy and mapping
  comparison/    leveling, adjusted pricing, anomaly rules, revisions, report rendering
  persistence/   SQLAlchemy models (SQLite) + AIInference lineage
  pipeline.py    single-submission and package-level orchestration
eval/            golden answer files + evaluation harness
tests/           pytest suite (all deterministic, via FakeProvider)
scripts/         fixture generators + the two CLI entrypoints
```

Not built yet, on purpose: no review dashboard, no n8n orchestration, no PDF report artifact,
no CRM writeback, no live email integration, no authentication. Those belong to Milestone 3 —
see `docs/architecture-review.md` Section 9 for the full 8-phase plan.

## Status

- **Milestone 1 — Foundation:** complete. Synthetic company, fixtures, provenance, extraction spine.
- **Milestone 2 — Intelligence:** complete. Four vendors across four formats, scope
  normalization, leveling with adjusted pricing, revision tracking, deterministic anomaly rules,
  golden evaluation.
- **Milestone 3 — Product:** next. Review dashboard, human approval workflow, report
  generation, simulated CRM writeback, n8n orchestration.
