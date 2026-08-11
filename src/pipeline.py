"""Vertical-slice pipeline orchestrator.

Wires the ten-step flow from docs/fixtures/apex-electrical-fixture-spec.md
"First Vertical Slice Acceptance Criteria":

  1. read the synthetic email event
  2. locate the proposal attachment
  3. hash it (SHA-256)
  4. extract page-aware PDF text deterministically
  5. resolve project/vendor/bid package
  6. call the AI provider abstraction for structured interpretation
  7. validate the result against Bid Schema v0.1
  8. persist SourceDocument, Bid, SourceCitation, AIInference (+ Allowance/Alternate/ScopeAssertion)
  9. return the extracted bid facts with visible source lineage
  10. (caller) compare against the golden answer via eval/run_eval.py

This module contains no AI-vendor-specific code and no pricing/comparison
logic -- it only orchestrates the modules in src/intake, src/extraction,
src/resolution, src/ai, and src/persistence.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import jsonschema

from src.ai.provider import AIProvider, ExtractionResult
from src.extraction.hashing import sha256_file
from src.extraction.pdf_text import PageText, extract_pages
from src.intake.email_event import load_email_event
from src.persistence import models
from src.persistence.db import session_scope
from src.resolution.resolver import resolve_bid_package, resolve_vendor


@dataclass
class PipelineResult:
    bid_id: str
    source_document_id: str
    ai_inference_id: str
    project_number: str
    bid_package_number: str
    vendor_name: str
    vendor_id: str
    extraction: ExtractionResult
    pages: list[PageText]
    source_document_filename: str
    source_document_sha256: str


def run(
    email_fixture_path: Path,
    repo_root: Path,
    schemas_dir: Path,
    provider: AIProvider,
    engine,
    prompt_version: str = "extract_bid_v1",
) -> PipelineResult:
    # Step 1-2: read the email event and locate the attachment.
    event = load_email_event(email_fixture_path, repo_root)
    attachment = event.attachments[0]
    if not attachment.path.exists():
        raise FileNotFoundError(f"Attachment referenced by {email_fixture_path} not found at {attachment.path}")

    # Step 3: hash the source document for provenance (Amendment 3).
    sha256 = sha256_file(attachment.path)

    # Step 4: deterministic, page-aware PDF text extraction.
    pages = extract_pages(attachment.path)

    # Step 5: deterministic project/vendor/bid-package resolution.
    bid_package = resolve_bid_package(event.project_number, event.bid_package_number, repo_root / "sample-data")
    vendor = resolve_vendor(event.vendor_name, repo_root / "sample-data")

    # Step 6: AI provider abstraction call for structured interpretation.
    extraction = provider.extract_bid(pages, prompt_version=prompt_version)

    # Step 7: validate against Bid Schema v0.1.
    schema = json.loads((schemas_dir / "bid.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(
        {
            "base_bid": extraction.base_bid,
            "allowances": extraction.allowances,
            "alternates": extraction.alternates,
            "scope_assertions": extraction.scope_assertions,
            "citations": extraction.citations,
            "confidence_tier": extraction.confidence_tier,
        },
        schema,
    )

    # Step 8: persist SourceDocument, Bid, Allowance, Alternate, ScopeAssertion,
    # SourceCitation, and AIInference.
    with session_scope(engine) as session:
        source_document = models.SourceDocument(
            filename=attachment.filename,
            sha256=sha256,
            source_type="vendor_proposal",
        )
        session.add(source_document)
        session.flush()  # populate source_document.id

        bid = models.Bid(
            project_number=bid_package.project_number,
            bid_package_number=bid_package.bid_package_number,
            vendor_id=vendor.vendor_id,
            source_document_id=source_document.id,
            base_bid=extraction.base_bid,
        )
        session.add(bid)
        session.flush()  # populate bid.id

        for allowance in extraction.allowances:
            session.add(models.Allowance(
                bid_id=bid.id,
                name=allowance["name"],
                amount=allowance["amount"],
                included_in_base_bid=allowance["included_in_base_bid"],
            ))

        for alternate in extraction.alternates:
            session.add(models.Alternate(
                bid_id=bid.id,
                alt_id=alternate["id"],
                amount=alternate["amount"],
                included_in_base_bid=alternate["included_in_base_bid"],
            ))

        for scope_key, status in extraction.scope_assertions.items():
            session.add(models.ScopeAssertion(bid_id=bid.id, scope_item_key=scope_key, status=status))

        for field_name, citation in extraction.citations.items():
            session.add(models.SourceCitation(
                bid_id=bid.id,
                field_name=field_name,
                source_document_id=source_document.id,
                page_number=citation["page"],
                section_label=citation["section"],
            ))

        ai_inference = models.AIInference(
            related_entity_type="Bid",
            related_entity_id=bid.id,
            task="extract_bid",
            provider=extraction.provider,
            model=extraction.model,
            prompt_version=prompt_version,
            source_document_ids=[source_document.id],
            structured_output=extraction.raw_output,
            confidence_tier=extraction.confidence_tier,
            review_status="pending",
        )
        session.add(ai_inference)
        session.flush()

        result = PipelineResult(
            bid_id=bid.id,
            source_document_id=source_document.id,
            ai_inference_id=ai_inference.id,
            project_number=bid_package.project_number,
            bid_package_number=bid_package.bid_package_number,
            vendor_name=vendor.name,
            vendor_id=vendor.vendor_id,
            extraction=extraction,
            pages=pages,
            source_document_filename=source_document.filename,
            source_document_sha256=source_document.sha256,
        )

    return result


def format_summary(result: PipelineResult) -> str:
    """Console summary explicitly separating Source Truth from AI Interpretation."""
    lines = []
    lines.append("=" * 78)
    lines.append(f"BID EXTRACTION SUMMARY -- {result.vendor_name} / {result.bid_package_number}")
    lines.append("=" * 78)

    lines.append("\n[SOURCE TRUTH]")
    lines.append(f"  Document: {result.source_document_filename}")
    lines.append(f"  SHA-256:  {result.source_document_sha256}")
    lines.append(f"  Pages:    {len(result.pages)}")

    lines.append("\n[AI INTERPRETATION]  "
                 f"(provider={result.extraction.provider}, model={result.extraction.model}, "
                 f"confidence={result.extraction.confidence_tier})")
    lines.append(f"  Base Bid: ${result.extraction.base_bid:,.2f}")
    for a in result.extraction.allowances:
        lines.append(f"  Allowance: {a['name']} = ${a['amount']:,.2f} "
                      f"(included_in_base_bid={a['included_in_base_bid']})")
    for a in result.extraction.alternates:
        lines.append(f"  Alternate {a['id']}: ${a['amount']:,.2f} "
                      f"(included_in_base_bid={a['included_in_base_bid']})")
    for key, status in result.extraction.scope_assertions.items():
        lines.append(f"  Scope: {key} = {status}")

    lines.append("\n[SOURCE CITATIONS]")
    for field_name, citation in result.extraction.citations.items():
        lines.append(f"  {field_name} -> page {citation['page']}, \"{citation['section']}\"")

    lines.append(f"\n[LINEAGE]  bid_id={result.bid_id}  ai_inference_id={result.ai_inference_id}")
    lines.append("=" * 78)
    return "\n".join(lines)
