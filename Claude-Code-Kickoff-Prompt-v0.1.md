\# Claude Code Kickoff Prompt v0.1

Use this prompt to begin implementation of the Bid Intelligence & Procurement Copilot.

\---

You are continuing the Bid Intelligence & Procurement Copilot project.

Before writing implementation code, review the current governing project documents in this Google Drive folder:

Project folder:  
https://drive.google.com/drive/folders/1Ran76MQ8GXEyfJCOzgsV-yLEBQizUleL

Primary documents:

1\. Bid Intelligence & Procurement Copilot \- Project Charter.md  
https://drive.google.com/file/d/1e3nUxp4\_aPqdL\_RciN4-KwmvUFN71P-i/view

2\. Architecture-Review-and-Deployment-Plan.md  
https://drive.google.com/file/d/1RTQAUM6Hq2FloYhFDkN1pfFFZe2fsGt6/view

3\. Architecture-Amendments-v1.0.md  
https://drive.google.com/file/d/11sWGA8q7anZra1a1ROhWnD6W3OsOlNpU/view

4\. Fictional-Company-Profile-v0.1.md  
https://drive.google.com/file/d/1Da4EvAnme8qSy3K6RyaLoj\_E9d3d5k6M/view

5\. Apex-Electrical-First-Fixture-v0.1.md  
https://drive.google.com/file/d/14Cc2c9j\_OW-biDse2537uR7CHEjnLUln/view

If you cannot access Google Drive directly, tell me exactly which of these files you need copied into the repository. Do not invent their contents.

\#\# Governing precedence

If the documents conflict, use this order of precedence:

1\. Architecture-Amendments-v1.0.md  
2\. Architecture-Review-and-Deployment-Plan.md  
3\. Bid Intelligence & Procurement Copilot \- Project Charter.md  
4\. Fictional-Company-Profile-v0.1.md and Apex-Electrical-First-Fixture-v0.1.md for synthetic demo facts

\#\# Current objective

We are no longer conducting broad architecture discovery.

The immediate goal is to begin Milestone 1 and produce the first vertical slice quickly and correctly.

Do not build the full product tonight.

Do not scaffold unnecessary infrastructure.

Do not create the dashboard, n8n workflows, four-vendor comparison, production authentication, live CRM integrations, or deployment hosting yet.

\#\# Architecture decisions already approved

Preserve these decisions unless implementation exposes a concrete blocker:

\- Python \+ FastAPI for application/business logic.  
\- SQLite for the local demo data layer.  
\- SQLAlchemy or equivalent clean persistence layer.  
\- Deterministic PDF/Excel parsing before AI reasoning.  
\- Claude as the initial AI provider.  
\- AI calls must sit behind an application-owned provider abstraction rather than direct Anthropic calls scattered through business logic.  
\- HIGH / REVIEW / LOW for AI confidence categories. Do not invent numeric confidence percentages.  
\- n8n will be used later for orchestration only. No business logic belongs in n8n.  
\- Human review and source citations are core product requirements.  
\- Source documents must receive SHA-256 hashes for provenance.  
\- Add lightweight AIInference/AIObservation lineage.  
\- Keep deterministic software CI separate from live-model evaluation.  
\- Discover/refine the schema using representative fixture data before freezing Demo Schema v1.0.  
\- Retain a concise docs/requirements.md for requirements traceability.

\#\# Tonight's scope

Start with the Apex Electrical first golden fixture only.

\#\#\# Step 1: Initialize the repository structure

Create only the minimum structure required for the vertical slice, including approximately:

\`\`\`text  
README.md  
docs/  
  requirements.md  
  architecture.md  
sample-data/  
  company/  
  projects/  
  vendors/  
  emails/  
  bids/  
schemas/  
src/  
  api/  
  intake/  
  extraction/  
  ai/  
  persistence/  
eval/  
  golden/  
tests/  
\`\`\`

Do not create empty directories for every future feature just because they appear in the long-term architecture.

\#\#\# Step 2: Bring source documents into the repository

Copy or recreate the governing markdown artifacts under \`docs/\` so the repository is self-contained.

Preserve the architecture review and amendments rather than rewriting their intent.

\#\#\# Step 3: Materialize the synthetic foundation

Using \`Fictional-Company-Profile-v0.1.md\`, create structured fixture data for:

\- Crestmark Construction Partners  
\- Falcon Medical Center Expansion  
\- Project 26-0147  
\- Bid package 26-0147-BP-26  
\- Apex Electrical Contractors

Use JSON fixtures where appropriate.

\#\#\# Step 4: Create the first actual Apex proposal fixture

Use \`Apex-Electrical-First-Fixture-v0.1.md\` as the authoritative fixture specification.

Generate a professional, text-based synthetic PDF proposal approximately 4-6 pages long.

Do not make it 17 pages yet.

The PDF must preserve the golden facts in the fixture specification and make citation targets unambiguous by page and section.

The proposal must clearly look synthetic in repository documentation, but the document itself should look like a believable professional subcontractor proposal.

\#\#\# Step 5: Draft the schema from the real fixture

After the Apex proposal exists, create Bid Schema v0.1 based on what the representative proposal actually contains.

Create only fields that are justified by the current requirements and fixture.

Include enough structure for:

\- vendor/project/bid-package identity  
\- base bid  
\- allowance  
\- alternate  
\- scope status  
\- source citations  
\- SourceDocument metadata including SHA-256  
\- AIInference lineage

Do not attempt to freeze the final multi-vendor schema yet.

\#\#\# Step 6: Create the golden answer

Create \`eval/golden/apex.json\` using the authoritative values from \`Apex-Electrical-First-Fixture-v0.1.md\`.

Golden facts must include at least:

\- Base Bid \= 191850.00  
\- Lighting fixture allowance \= 42500.00 and included in base bid  
\- Alternate A1 \= \+8750.00 and not included in base bid  
\- Electrical permit fees \= Included  
\- Performance/payment bond \= Excluded  
\- Arc-flash study \= NotFound

\#\#\# Step 7: Build the deterministic extraction spine

Implement:

\- synthetic incoming email fixture  
\- source-file SHA-256 hashing  
\- PDF text extraction  
\- page-aware text representation  
\- project/vendor resolution using deterministic identifiers first  
\- schema validation  
\- SQLite persistence skeleton

Do not call an LLM yet if the deterministic foundation is not testable.

\#\#\# Step 8: Add the AI provider boundary

Define an application-owned interface for AI operations.

Implement Anthropic as the first provider adapter.

The business logic should not import/use Anthropic directly outside the provider adapter.

Begin with only the AI operation necessary for the Apex structured extraction task.

Store lightweight inference lineage including provider/model, prompt version, source document id, result, confidence tier, and review status.

\#\#\# Step 9: Complete the first vertical slice

One command should:

1\. read the synthetic Apex email event  
2\. locate the Apex proposal  
3\. calculate its SHA-256 hash  
4\. extract page-aware PDF text deterministically  
5\. resolve project/vendor/bid package  
6\. call the AI provider abstraction for structured interpretation  
7\. validate the result against Bid Schema v0.1  
8\. persist SourceDocument, Bid, SourceCitation, and AIInference data in SQLite  
9\. output the extracted bid facts with visible source lineage  
10\. compare critical fields against the golden Apex answer

\#\# Testing requirement

Add deterministic tests immediately.

At minimum test:

\- fixture/schema validity  
\- document hashing  
\- PDF extraction  
\- project/vendor resolution  
\- exact base-bid value after structured extraction  
\- golden expected scope statuses  
\- citation presence

Do not configure every live-model call to run on every Git commit.

Keep deterministic CI and live AI evaluation conceptually separate as required by Architecture-Amendments-v1.0.md.

\#\# Requirements traceability

Create \`docs/requirements.md\` with concise requirement IDs beginning with the approved list in Architecture-Amendments-v1.0.md.

Where practical, reference requirement IDs in tests or documentation.

\#\# How to work

Use Plan Mode first.

Before making substantial edits, give me:

1\. your proposed minimal file tree  
2\. the exact vertical-slice execution flow  
3\. the first schema entities you intend to implement  
4\. any conflicts you detect among the governing documents  
5\. any dependency or API-key requirement that could block autonomous progress

If there are no material blockers, proceed with implementation after that plan rather than asking me a long series of preference questions.

Favor sensible defaults and document them.

Keep the implementation small, testable, and boring where boring technology is better.

Do not optimize for impressive code volume.

Optimize for a working architectural spine with provenance, tests, and a clean path to the later four-vendor demo.

\#\# Stop condition for this session

Do not expand into Phase 4 comparison, Next.js UI, n8n, reporting, or production integrations.

Stop when the Apex first vertical slice is working, tested, documented, and ready for review.

At the end, produce a concise implementation report containing:

\- files created  
\- architecture decisions implemented  
\- tests and evaluation results  
\- any deviations from the governing documents  
\- known limitations  
\- exact recommended next action

If a blocker prevents completion, leave the repository in a clean state and document the blocker precisely instead of inventing a workaround that violates the architecture.  
