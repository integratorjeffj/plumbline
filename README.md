# Plumbline

**Reads subcontractor bids in whatever format they arrive in, levels them onto one scope vocabulary, and shows what each bid actually costs.**

[**Live Demo →**](https://integratorjeffj.github.io/plumbline)

---

## What it does

A general contractor's estimator receives four bids for the same electrical package. One arrives as a PDF, one as an Excel workbook, one as pricing typed into an email body, and one as a proposal that gets revised two days later after an addendum. Comparing them means reading every document, figuring out what each vendor did and did not include, and mentally adding back the gaps.

Plumbline does that comparison and shows its work:

```
  Vendor                               Submitted  Rank      Adjusted  Rank   Move
  ------------------------------------------------------------------------------
  Voltage Systems Inc.                  $167,400     1      $223,700     4     -3
  Meridian Electric & Controls          $178,950     2      $188,550     2      -
  Ironclad Power & Electric             $179,750     3      $186,250     1     +2
  Apex Electrical Contractors           $191,850     4      $201,450     3     +1
```

The low bidder excluded the lighting fixture allowance and the permit fees. Once those are priced, it becomes the most expensive bid on the table.

It also finds what a price comparison structurally cannot: the **arc-flash study required by specification section 26 05 73 that none of the four bidders covered**. Because all four omitted it, nothing in the bid spread looks unusual, yet the whole package is underpriced against the specification.

### The leveling formula

```
adjusted total = submitted total + Σ (estimator value for each uncovered in-package scope item)
```

Every bid is mapped onto a fixed 14-item scope taxonomy, and every bidder must answer for every item:

| Status | Meaning | Triggers an adjustment |
|---|---|---|
| `Included` | Vendor explicitly includes it | No |
| `Excluded` | Vendor explicitly excludes it | Yes |
| `Unclear` | Mentioned but genuinely ambiguous | No, becomes a clarification request |
| `NotFound` | Proposal is silent on it | Yes |

Two rules make this work:

- **`NotFound` never collapses into `Excluded`.** "The vendor said no" and "the proposal never mentions it" carry different risk. Conflating them would have erased the arc-flash finding entirely.
- **Scope carried by other bid packages is never priced.** Division 27, Division 28, and utility charges are excluded by all four bidders, but adding them here would double-count against another package's budget. The engine records that decision rather than silently skipping the rows.

---

## Features

- **Four input formats**, one pipeline: PDF, Excel workbook, email-body pricing, and revised resubmissions
- **Scope normalization** onto a canonical Division 26 taxonomy with a four-state vocabulary
- **Bid leveling** with adjusted pricing and rank-movement tracking
- **Seven deterministic anomaly rules**: arithmetic discrepancy, stale drawing revision, required scope missing from every bidder, large leveling delta, unclear scope, over budget, superseded revision
- **Revision tracking** so a reissued proposal supersedes its predecessor instead of double-counting as another bidder
- **Source citations** on every extracted figure, down to page and section, or sheet and cell range for spreadsheets
- **SHA-256 provenance** on every ingested document
- **AI inference lineage** stored separately from vendor-submitted fact, with provider, model, prompt version, confidence tier, and review status
- **75 deterministic tests** including 55 golden assertions, none of which require a live API call

---

## Why it's built this way

**The AI reads. The code decides.** Claude classifies scope language and pulls figures out of prose, which is genuinely hard language work. Every ranking, sum, and anomaly rule is ordinary Python. Letting a model do the arithmetic would trade a reproducible answer for an unreproducible one and buy nothing. Ask the same question twice and you get the same numbers.

**Adjustment values are entered by a human, never derived by the model.** Plumbline detects that a bidder excluded permit fees. Deciding that gap is worth $4,200 is the estimator's judgment. The adjustment loader refuses any file not explicitly marked `estimator_entered`, because an AI-guessed number sitting next to real vendor pricing is indistinguishable from a quote the vendor never gave.

**Vendor arithmetic is preserved, not repaired.** One bid states a total of $178,950 while its own line items sum to $181,450. The extractor records the stated total exactly as written. Silently fixing the vendor's math would destroy the finding.

**Confidence is `HIGH`, `REVIEW`, or `LOW`.** Never a percentage. A model reporting "87% confident" implies a calibration that does not exist, and estimators reasonably treat invented precision as a reason to distrust everything else on the page.

**The default test run never calls a live model.** Software CI stays deterministic using recorded responses. Live-model evaluation is a separate, explicitly triggered concern. A test suite that fails because an API was slow teaches people to ignore failing tests.

---

## Running it locally

```bash
git clone https://github.com/integratorjeffj/plumbline.git
cd plumbline
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
```

Run the four-vendor comparison offline, no API key needed:

```bash
python scripts/run_comparison.py --fake
```

Run the test suite:

```bash
python -m pytest
```

Run live extraction against Claude (requires `ANTHROPIC_API_KEY` in a local `.env`):

```bash
python scripts/run_comparison.py
```

Or just visit the [live demo](https://integratorjeffj.github.io/plumbline).

---

## What is real and what is stubbed

The demo page labels this too, because a portfolio project that implies connections it does not have is worse than one that admits the boundary.

| Capability | Status | Notes |
|---|---|---|
| PDF and Excel extraction | Live | Real parsing, real files, positions preserved for citation |
| Scope normalization and leveling | Live | Deterministic Python |
| Anomaly detection | Live | Seven rules, no model involved |
| Claude extraction | Ready, key required | Adapter built and schema-constrained via tool use |
| Email intake | Simulated | JSON fixtures shaped like real webhook payloads |
| CRM writeback | Planned | Procore / Autodesk Construction Cloud |
| Workflow orchestration | Planned | n8n, routing only, never business logic |
| Human approval workflow | Planned | `review_status` field exists, review UI does not |

All demo data is synthetic. Crestmark Construction Partners, the Falcon Medical Center project, and all four bidders are fictional. No real bid data is represented anywhere in this repository.

---

## Roadmap

- [ ] Review dashboard so an estimator can approve, reject, or correct each AI inference before it counts
- [ ] Generated leveling report as a shareable PDF rather than console output
- [ ] Live mailbox intake via Microsoft Graph, replacing the simulated email fixtures
- [ ] CRM writeback to Procore so leveled results land where the estimator already works
- [ ] Vendor performance history, so past change-order behavior informs the current comparison
- [ ] Live-model evaluation harness measuring extraction accuracy against the golden set across model versions

---

## Also built

**Flowline**
Focus command center. Ranks tasks by deadline, priority, and available time, then surfaces exactly one thing to work on next. Live at [integratorjeffj.github.io/flowline](https://integratorjeffj.github.io/flowline).

**AI Proposal Workflow**
Guided proposal generation for telecom and managed services deals. Produced 9 proposals and over $400K in quoted work within 5 business days of rollout.

**QBO Invoicing Automation**
Recurring invoice automation across 245+ customers using the QuickBooks Online API and OAuth 2.0, replacing a fully manual monthly process.

**Guided Network Deployment Tools**
WireGuard and RouterOS configuration wizards. Structured inputs, validation, generated config, and readback checks to eliminate hand-editing errors.

**AI Employee Enablement Framework**
Coaching-led adoption framework using the Harvest the Win methodology, moving teams from scattered AI experimentation to repeatable organizational capability.

---

## About

Built by [Jeff Jenkins](https://github.com/integratorjeffj), AI integration, automation, and managed technology operations.

Currently focused on AI adoption and enablement roles: helping organizations move from AI experimentation to repeatable, governed, business-value-producing workflows.
