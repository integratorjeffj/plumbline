# Bid Intelligence & Procurement Copilot

An AI-assisted procurement and bid-leveling platform for construction subcontractor bids —
currently at **Milestone 1: Foundation** (the first vertical slice), built against a fully
synthetic demo company and one representative subcontractor proposal.

This repository is a portfolio demonstration. All companies, people, prices, and documents
are fictional (see `docs/company-profile.md`).

## What's here right now

A single command ingests one synthetic email, hashes and extracts the attached PDF proposal,
resolves it to a project/vendor/bid-package record, calls an AI provider for structured
extraction, validates the result, persists it with full source lineage, and checks it against
a hand-authored golden answer:

```bash
python -m venv .venv
.venv/Scripts/activate       # or: source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt

python scripts/run_slice.py --fake     # offline, deterministic (no API key needed)
python scripts/run_slice.py            # live Claude extraction (requires ANTHROPIC_API_KEY)
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

23 deterministic tests, all running against `FakeProvider` — no live model call is part of
the default test run, by design (`docs/architecture-amendments.md` Amendment 4: software CI
stays deterministic; live-model evaluation is a separate, explicitly-triggered concern).

## Governing documents

Read in this order of precedence (see `docs/architecture-amendments.md` for the full rule):

1. [`docs/architecture-amendments.md`](docs/architecture-amendments.md) — approved amendments to the architecture review
2. [`docs/architecture-review.md`](docs/architecture-review.md) — Principal Architect review, tech stack, 8-phase plan
3. [`docs/charter.md`](docs/charter.md) — original product vision/concept
4. [`docs/company-profile.md`](docs/company-profile.md) and [`docs/fixtures/apex-electrical-fixture-spec.md`](docs/fixtures/apex-electrical-fixture-spec.md) — synthetic demo facts
5. [`docs/requirements.md`](docs/requirements.md) — requirement IDs, traced to implementation and tests

## Project layout

```
docs/            governing documents + requirements traceability
sample-data/     synthetic company/project/vendor records, email event, PDF proposal
schemas/         Bid Schema v0.1 (also used as the Claude tool input_schema)
src/
  config.py      environment loading (ANTHROPIC_API_KEY, DB path)
  intake/        email event loading
  extraction/    SHA-256 hashing, page-aware PDF text extraction
  resolution/    deterministic project/vendor/bid-package matching
  ai/            AIProvider abstraction: FakeProvider + AnthropicProvider
  persistence/   SQLAlchemy models (SQLite) + AIInference lineage
  pipeline.py    orchestrates the ten-step vertical slice
eval/            golden answer file + evaluation harness
tests/           pytest suite (all deterministic, via FakeProvider)
scripts/
  generate_apex_pdf.py   builds the synthetic Apex proposal PDF
  run_slice.py           the one-command vertical slice entrypoint
```

Not built yet, on purpose: no dashboard, no n8n orchestration, no second/third/fourth vendor,
no comparison engine, no live CRM/email integration. Those belong to later milestones — see
`docs/architecture-review.md` Section 9 for the full 8-phase plan.

## Status

Milestone 1 (Foundation) vertical slice: **complete** for the Apex Electrical fixture.
Next: Milestone 2 (Intelligence) — extend to the remaining three vendors and build the
comparison/anomaly engine.
