# Plumbline

**Reads subcontractor bids in whatever format they arrive in, levels them onto one scope vocabulary, and shows what each bid actually costs.**

[**Live Demo →**](https://integratorjeffj.github.io/plumbline/) · [**Review Console →**](https://integratorjeffj.github.io/plumbline/console/) · [How the leveling works](#the-leveling-formula) · [What is real, what is stubbed](#what-is-real-and-what-is-stubbed)

`Python` `Claude API` `pdfplumber` `openpyxl` `SQLAlchemy` `Next.js 15` `TypeScript` `pytest`

A general contractor's estimator gets four bids for the same electrical package in four different formats, and the cheapest one is rarely the cheapest one. Plumbline normalizes every bid onto a single scope taxonomy, prices the gaps each vendor left out, and re-ranks them on what they would actually cost.

## See it in 60 seconds

1. **Look at the ranking table below.** The low bidder at $167,400 lands fourth at $223,700 once its missing lighting allowance and permit fees are priced in. The rank-movement column is the whole product in one number.
2. **Open the [Review Console](https://integratorjeffj.github.io/plumbline/console/) and click any extracted figure.** It jumps to the page and section it was cited from. Approve it, correct it, or reject it, and correcting a scope status re-levels the package on the spot.
3. **Go to Scope & weighting and change an importance grade.** The ranking recomputes in the browser. The parity badge on the overview page is checking that browser math against the Python pipeline's exported totals on every load, and turns red if they ever disagree.
4. **Open Award and click "Track record first."** The recommendation flips from the cheapest eligible bid to the incumbent with the better change-order history, and the written rationale rewrites itself to explain the $15,200 premium. Two bidders never enter the ranking at all -- Prequalification shows which gate stopped each one.

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

### The review console

The [console](https://integratorjeffj.github.io/plumbline/console/) is the interface an estimator
actually works in. It sits in a persistent application shell: a left sidebar carrying program-level
navigation and, when a package is open, that package's own routes nested beneath it, plus a top bar
with the breadcrumb, a global package search, and the theme toggle. The sidebar collapses to an
icon rail, and below 768px it leaves the layout entirely and returns as a drawer.

- **Review** puts the source document beside the extraction. Click any extracted figure to jump to
  the page and section it was cited from, then approve it, correct it, or reject the submission.
  Correcting a scope status re-levels the package immediately.
- **Compare** shows the leveling bars, both rankings, the full scope matrix, revision history, and
  every finding.
- **Prequalification** is the eligibility record behind each bidder: EMR against the policy band,
  bonding capacity, insurance limits against the contract minimums, past performance, and every
  gate that passed, warned, or stopped them.
- **Award** weighs the eligible bidders across cost, experience, safety, and schedule. Drag a
  weight and the ranking and the written rationale both move; gated bidders stay visible but
  never enter the ranking.
- **Scope & weighting** is where the estimator assigns each scope item an importance grade and a
  dollar value. Change a grade and the ranking recomputes on the spot.
- **Data sources** carries the connector placeholders and a live-mode upload that computes a real
  SHA-256 in the browser.
- **Stakeholder report** is a one-page, print-to-PDF summary of a single package -- budget, leveled
  low bid, RAG health, the ranking table, and top findings -- for sharing outside the console.

The console opens on **Bid packages**, listing every active package, since a real estimator carries
more than one job at a time. Each package -- Falcon Medical's electrical scope, a mechanical
package, a second electrical package with its own vendors and taxonomy -- is a fully separate
leveling run with its own scope weights and review decisions, so approving a bid on one package
never touches another.

That page is one table and five metric tiles, and nothing else. The tiles are not decorative:
pressing **Variance to budget** or **High-severity findings** narrows the table to exactly the
packages that metric is about. The table carries search, a status filter, sort, a density toggle,
labeled OK / Watch / Flag status pills with the thresholds behind them stated in a legend, a
per-package pending-review badge, an inline budget-vs-leveled bar on a scale shared down the
column, bid dates, and a per-row menu into that package's routes. Below it, a fortnight of findings
raised against findings cleared. The health thresholds are exact and computed, not eyeballed -- see
`web/lib/portfolio.ts`.

**On RAG health, deliberately.** Only Scope, Cost, and Risk get a health indicator, because those
are the only three dimensions the engine actually computes something for. Plumbline has no
schedule or safety data, so there's no Time or Safety pill -- adding one would mean inventing a
number. Likewise, the portfolio KPI language says "leveled bid exposure," never "committed" or
"paid": Plumbline is a pre-award tool, and it stops at a human approving an extraction. It does not
track anything that happens after a bid is awarded.

**On the dates, deliberately.** Plumbline records when a submission arrived and nothing else: no
event log, no review audit trail, no bid calendar. The bid dates, review timestamps, and the
day-to-day shape of the activity strip are therefore generated, and the strip says so on its face.
Two things keep that from being decoration. Nothing reads the wall clock -- "now" is the most
recent submission in the dataset, because a static export prerendered at build time that computed
"days ago" against `Date.now()` would disagree with itself between the build and the browser and
drift further every day the demo sat unvisited. And the generated series are pinned to real engine
output at both ends: the raised series sums to the actual finding count, and the backlog left
standing equals the actual high-severity count. See `web/lib/timeline.ts`.

Nothing is auto-accepted. Every AI inference is stored as a separate lineage record with a
`review_status` a human has to clear.

**On running the same math twice.** The console re-levels in the browser so weighting changes are
instant, which means the leveling logic exists in both Python and TypeScript. That is a genuine
drift risk, so it is checked rather than trusted: on every load the console re-levels at default
settings and compares its totals against the ones the Python pipeline exported. The parity badge on
the overview page is driven by that check and turns red if the two ever disagree.

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


### Eligibility is a separate question from price

Leveling produces a defensible number. It does not produce a decision, and treating it as one is
how a package gets awarded to a firm the GC's insurer will not accept.

So Plumbline separates the two. **Gates** decide whether a subcontractor may be carried at all;
**weights** rank whoever is left. A gate is never a weight, because a weight lets a low price buy
back a safety record, and that is exactly the trade the policy exists to forbid.

On the Falcon Medical electrical package, two of four bidders clear prequalification:

| Bidder | Leveled | EMR | Outcome |
|---|---|---|---|
| Ironclad Power & Electric | $186,250 | 0.78 | Eligible |
| Meridian Electric & Controls | $188,550 | 1.12 | **Gated** -- EMR above the 1.00 maximum |
| Apex Electrical Contractors | $201,450 | 0.89 | Eligible, with a certificate expiring in 37 days |
| Voltage Systems Inc. | $223,700 | 0.96 | **Gated** -- umbrella carried at $2M against a $5M requirement |

Meridian is the finding leveling alone cannot produce. It levels to second, within $2,300 of the
lead, so on price it is a live candidate right up until someone reads its loss history. Gated
bidders are still scored and still shown, because the number a gate cost is exactly what a reviewer
needs to weigh the gate against -- but that number never becomes selectable.

The award model then weighs the survivors across cost, experience, safety, and schedule, defaulting
to a conventional 40/30/20/10 split. Move the weights and the ranking moves with them: at the
default, Ironclad wins on price and safety; weight past performance to 60% and Apex takes it on a
better change-order rate and a longer track record, at a $15,200 premium. The recommendation
rewrites itself to say so, naming the exclusions and what each one cost.

The rationale is generated deterministically rather than by a model call. A recommendation an
estimator signs their name to has to read the same every time it is produced and has to be
reconstructible from the numbers alone.

### Coverage: the bids that never arrived

A package can look healthy because four proposals sit side by side, when the reason the spread is
narrow is that the firms who would have priced it lower never responded. Coverage is therefore
measured from the invitation out -- seven invited, four responsive, two declined with reasons, one
silent after two follow-ups.

Addendum acknowledgment is inferred from the drawing revision each proposal states it priced
against, rather than from a signed acknowledgment page. Meridian priced Revision 1 while the package
is at Revision 3, so it never incorporated Addenda 2 and 3 -- and Addendum 3 is the one that added
the arc-flash requirement. A signature would have proved someone signed a page; the cited revision
proves what the number actually covers.

---

## Features

- **Four input formats**, one pipeline: PDF, Excel workbook, email-body pricing, and revised resubmissions
- **Scope normalization** onto a canonical Division 26 taxonomy with a four-state vocabulary
- **Bid leveling** with adjusted pricing and rank-movement tracking
- **Ten deterministic anomaly rules**: arithmetic discrepancy, stale drawing revision, required scope missing from every bidder, large leveling delta, unclear scope, over budget, superseded revision, unacknowledged addenda, thin bid coverage, silent invitations
- **Revision tracking** so a reissued proposal supersedes its predecessor instead of double-counting as another bidder
- **Prequalification gates** -- EMR, insurance limits, certificate currency, single-project and aggregate bonding capacity, review staleness -- evaluated as of a stated date, with DBE/MBE/WBE participation surfaced
- **Weighted award recommendation** across cost, experience, safety, and schedule, re-ranking live as the weights move, with a generated rationale that names every exclusion and the price it cost
- **Bid coverage tracking** measured from the invitation out: invited, responded, declined, silent, plus addendum acknowledgment inferred from the drawing revision each proposal priced
- **Portfolio rollup** across every bid package: combined budget, leveled exposure, variance, and per-package RAG health, computed live from the same engine each package's own pages use
- **A working table, not a list**: search, status filter, sort, density, labeled status pills with their thresholds stated, inline budget-vs-leveled bars on a shared scale, and metric tiles that filter the rows beneath them
- **Printable stakeholder report**, one page, via the browser's native print-to-PDF
- **Responsive to 380px**, where the package table becomes stacked cards rather than a sideways scroll, with keyboard focus rings throughout and `prefers-reduced-motion` honored
- **Source citations** on every extracted figure, down to page and section, or sheet and cell range for spreadsheets
- **SHA-256 provenance** on every ingested document
- **AI inference lineage** stored separately from vendor-submitted fact, with provider, model, prompt version, confidence tier, and review status
- **138 deterministic tests** across [`tests/`](tests/), none of which require a live API call, including golden-set comparisons against five recorded fixtures in [`eval/golden/`](eval/golden/) via [`tests/test_pipeline_golden.py`](tests/test_pipeline_golden.py) and [`tests/test_package_golden.py`](tests/test_package_golden.py)

---

## Why it's built this way

**The AI reads. The code decides.** Claude classifies scope language and pulls figures out of prose, which is genuinely hard language work. Every ranking, sum, and anomaly rule is ordinary Python. Letting a model do the arithmetic would trade a reproducible answer for an unreproducible one and buy nothing. Ask the same question twice and you get the same numbers.

**Adjustment values are entered by a human, never derived by the model.** Plumbline detects that a bidder excluded permit fees. Deciding that gap is worth $4,200 is the estimator's judgment. The adjustment loader refuses any file not explicitly marked `estimator_entered`, because an AI-guessed number sitting next to real vendor pricing is indistinguishable from a quote the vendor never gave.

**Vendor arithmetic is preserved, not repaired.** One bid states a total of $178,950 while its own line items sum to $181,450. The extractor records the stated total exactly as written. Silently fixing the vendor's math would destroy the finding.

**Confidence is `HIGH`, `REVIEW`, or `LOW`.** Never a percentage. A model reporting "87% confident" implies a calibration that does not exist, and estimators reasonably treat invented precision as a reason to distrust everything else on the page.

**The default test run never calls a live model.** Software CI stays deterministic using recorded responses. Live-model evaluation is a separate, explicitly triggered concern. A test suite that fails because an API was slow teaches people to ignore failing tests.

**One job per color, one scale for type.** The stylesheet opens with a written color contract, and
the interface holds to it. Indigo means you can act on it and never encodes a quantity, which is
why the money bars are teal: a colored bar sitting next to a link has to be visibly not a link.
Amber means something needs attention, green means good or resolved, red means a threshold is
breached, slate is a neutral provenance label. Monospace is the data face, so it appears on dollar
figures, dates, counts, package codes, spec sections, hashes, and file paths, and nowhere else --
project names and status pills are words and take the body face. Font sizes come from a nine-step
scale declared as custom properties rather than being invented per component. Every text pair in
the palette clears 4.5:1 in both light and dark.

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

Or just visit the [live demo](https://integratorjeffj.github.io/plumbline/).

### Building the console

The console is a Next.js app that static-exports into `docs/console/` (GitHub Pages serves this
repo from `/docs`). Every bid package it can open lives as one file under `demo/projects/`.
Falcon Medical's is Python-derived; regenerate it from the pipeline:

```bash
python scripts/export_demo_data.py
```

The other demo packages are hand-authored seeds run through the same TypeScript leveling and
findings engine the browser calls at runtime (`web/lib/leveling.ts`, `web/lib/findings.ts`), so
their numbers are computed, not typed by hand -- see `web/data/seeds/*.seed.json` and
`web/scripts/build-demo-projects.ts`:

```bash
cd web && npm install && npm run build:demo-projects
```

Then build and publish:

```bash
npm run build
```

`npm run build` syncs every file in `demo/projects/` into the app, builds, and publishes the
static output to `docs/console/`. Adding a new bid package to the directory is: a new file under
`demo/projects/`, one line in `web/lib/projects.ts`, rebuild.

---

## What is real and what is stubbed

The demo page labels this too, because a portfolio project that implies connections it does not have is worse than one that admits the boundary.

| Capability | Status | Notes |
|---|---|---|
| PDF and Excel extraction | Live | Real parsing, real files, positions preserved for citation |
| Scope normalization and leveling | Live | Deterministic Python |
| Anomaly detection | Live | Ten rules, no model involved |
| Prequalification gates | Live | Deterministic Python, evaluated as of a stated date |
| Weighted award model | Live | Scored in Python, mirrored in the browser under a parity check |
| Bid coverage and addenda | Live | Invitation log plus acknowledgment inferred from cited drawing revisions |
| Human review and sign-off | Live | Side-by-side console, per-field decisions, persisted locally |
| Scope weighting and re-leveling | Live | Importance grades recompute rankings and findings in the browser |
| Claude extraction | Ready, key required | Adapter built and schema-constrained via tool use |
| Email intake | Simulated | JSON fixtures shaped like real webhook payloads |
| Document upload | Partial | Real SHA-256 in the browser; parsing and extraction need the Python service |
| CRM writeback | Planned | Procore / Autodesk Construction Cloud |
| Workflow orchestration | Planned | n8n, routing only, never business logic |

All demo data is synthetic. Crestmark Construction Partners, the Falcon Medical Center project, and all four bidders are fictional. No real bid data is represented anywhere in this repository.

---

## Roadmap

- [ ] Persist review decisions server-side so a team shares one review state instead of one per browser
- [ ] Hosted extraction endpoint so an uploaded document runs the real pipeline, not just hashing
- [ ] Generated leveling report as a shareable PDF rather than a screen
- [ ] Live mailbox intake via Microsoft Graph, replacing the simulated email fixtures
- [ ] CRM writeback to Procore so leveled results land where the estimator already works
- [ ] Live-model evaluation harness measuring extraction accuracy against the golden set across model versions
- [ ] Resolve vendor identity across bid packages so prequalification and performance history roll up program-wide

---

## Also built

**Flowline**
Focus command center. Ranks tasks by deadline, priority, and available time, then surfaces exactly one thing to work on next. Live at [integratorjeffj.github.io/flowline](https://integratorjeffj.github.io/flowline/).

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

Built by Jeff Jenkins. AI integration, automation, and managed technology operations.

Currently focused on AI adoption and enablement roles: helping organizations move from AI experimentation to repeatable, governed, business-value-producing workflows.

---

[View my GitHub profile](https://github.com/integratorjeffj) · [LinkedIn](https://www.linkedin.com/in/integratorjeffj/)
