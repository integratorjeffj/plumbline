\# Bid Intelligence & Procurement Copilot  
\#\# Architecture Amendments v1.0

\*\*Status:\*\* Approved working amendments to \`Architecture-Review-and-Deployment-Plan.md\`  
\*\*Purpose:\*\* Preserve the strongest recommendations from the architecture review while tightening provider portability, provenance, evaluation discipline, schema discovery, and requirements traceability.

\#\# Amendment 1: Add an AI Provider Abstraction

Use Claude as the first AI provider, but do not scatter direct Anthropic API calls throughout the application.

Define an application-owned AI contract with operations such as:

\- classify\_email()  
\- extract\_bid()  
\- normalize\_scope()  
\- draft\_clarification()  
\- summarize\_revision()

Implement an \`AnthropicProvider\` first. Preserve a clean seam for future \`OpenAIProvider\` or \`GeminiProvider\` adapters without changing business logic.

\*\*Reason:\*\* the application should own the AI contract. The model vendor should implement it.

\#\# Amendment 2: Add Lightweight AI Inference Lineage

Do not store all AI analysis only as fields directly on Bid or ScopeItem.

Add a lightweight \`AIInference\` or \`AIObservation\` record containing at minimum:

\- id  
\- related entity id  
\- field or task  
\- model/provider  
\- prompt version  
\- source document id(s)  
\- structured output  
\- confidence tier: HIGH / REVIEW / LOW  
\- timestamp  
\- review status

This enables the system to answer: "Why does the platform think this scope item is excluded?"

Desired lineage:

\`\`\`text  
Source Document  
  \-\> Extracted Text  
  \-\> Prompt Version  
  \-\> Model  
  \-\> Structured AI Inference  
  \-\> Human Review / Correction  
\`\`\`

\#\# Amendment 3: Strengthen Source Integrity with Content Hashes

The demo source files are not technically immutable simply because they are stored under \`/sample-data\`.

For every source document, calculate and store a SHA-256 content hash.

Minimum metadata:

\- document\_id  
\- filename  
\- sha256  
\- ingested\_at  
\- source type

If source bytes change, the hash changes and the system must treat the file as a new source version or flag the integrity mismatch.

\*\*Reason:\*\* this provides credible source-version provenance with very little implementation cost.

\#\# Amendment 4: Separate Software CI from Live-Model Evaluation

Run deterministic regression tests on every commit and allow them to block the build.

Examples:

\- schema validation  
\- arithmetic checks  
\- anomaly rules  
\- comparison calculations  
\- API contracts  
\- deterministic revision logic  
\- fixture parsing

Do not require a fresh live LLM call on every Git commit.

Run live-model evaluations when:

\- prompt files change  
\- AI extraction logic changes  
\- explicitly triggered manually  
\- scheduled for periodic evaluation

Store evaluation reports so model behavior can be compared over time.

\*\*Reason:\*\* software tests should be deterministic and cheap. AI evaluation is probabilistic, provider-dependent, and should be managed as a distinct discipline.

\#\# Amendment 5: Use Representative Data to Discover the Demo Schema

Do not fully freeze the canonical schema before representative bid fixtures exist.

Preferred sequence:

\`\`\`text  
Draft Apex proposal  
  \-\> Draft Bid Schema v0.1  
  \-\> Create Apex golden record  
  \-\> Validate schema against Apex  
  \-\> Create Vendors B-D fixtures  
  \-\> Refine schema  
  \-\> Freeze Demo Schema v1.0  
\`\`\`

\*\*Reason:\*\* the schema should be informed by realistic proposal structures instead of designed only from abstract requirements.

\#\# Amendment 6: Keep a Lightweight Requirements Traceability File

Retain \`docs/requirements.md\` even though the charter and architecture plan already describe the product.

Initial requirements should be concise and uniquely identified, for example:

\- REQ-001 Ingest bid documents  
\- REQ-002 Preserve source provenance  
\- REQ-003 Match bid to project  
\- REQ-004 Extract submitted total  
\- REQ-005 Normalize scope  
\- REQ-006 Detect exclusions and unclear scope  
\- REQ-007 Detect arithmetic discrepancies  
\- REQ-008 Detect project-required scope missing across bidders  
\- REQ-009 Require human approval  
\- REQ-010 Produce bid-leveling report  
\- REQ-011 Simulate CRM writeback  
\- REQ-012 Preserve AI inference lineage

Tests and demo evidence should eventually reference requirement IDs where practical.

Desired traceability:

\`\`\`text  
Business Requirement  
  \-\> Architecture  
  \-\> Implementation  
  \-\> Test / Evaluation  
  \-\> Demo Evidence  
\`\`\`

\#\# Confirmed Decisions from Architecture Review

The following recommendations are approved unless implementation reveals a concrete reason to revisit them:

\- V1 uses one flagship scenario: Falcon Medical Center Expansion, Division 26 Electrical.  
\- V1 uses n8n for visible orchestration only.  
\- FastAPI owns business logic and workflow APIs.  
\- Python owns deterministic calculations, validation, comparison, and anomaly rules.  
\- Claude is the initial AI provider for probabilistic extraction, interpretation, and drafting.  
\- SQLite is appropriate for the local demo; PostgreSQL is a later production replacement.  
\- Next.js is appropriate for the human review dashboard.  
\- Source citations and human review remain mandatory product concepts.  
\- HIGH / REVIEW / LOW replaces fake numeric AI confidence percentages.  
\- Vendor performance scoring, change-order prediction, negotiation intelligence, real RBAC/OAuth, live CRM/email integrations, and role-based digests are deferred beyond V1.  
\- n8n must not contain pricing logic, normalization logic, comparison rules, or prompts.

\#\# Milestone View

The eight detailed phases remain valid, but progress should be communicated through four major milestones:

\#\#\# Milestone 1: Foundation  
Phases 1-2

Synthetic company, representative fixtures, schema discovery, source ingestion, structural extraction, provenance.

\#\#\# Milestone 2: Intelligence  
Phases 3-4

AI extraction, golden evaluations, normalization, comparison, anomaly detection.

\#\#\# Milestone 3: Product  
Phases 5-7

Dashboard, human review, reports, simulated CRM, n8n orchestration.

\#\#\# Milestone 4: Portfolio  
Phase 8

GitHub documentation, demo recording, evaluation evidence, architecture story.

\#\# Immediate Build Rule

Architecture is sufficiently mature to begin implementation.

Do not create another broad architecture survey unless an implementation blocker exposes a real design problem.

The next work should begin with representative fictional data and the first vertical slice.  
