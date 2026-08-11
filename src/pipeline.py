"""Extraction pipeline orchestrator.

`run_single` handles one inbound submission end to end:

  1. read the synthetic email event
  2. locate the attachment
  3. hash it (SHA-256)
  4. extract page-aware text deterministically (PDF or Excel)
  5. resolve project/vendor/bid package
  6. call the AI provider abstraction for structured interpretation
  7. validate the result against the bid schema
  8. persist SourceDocument, Bid, line items, allowances, alternates,
     scope assertions, citations, and the AIInference lineage record
  9. return the extracted facts with visible source lineage

`run_package` runs that for every submission in a bid package, then applies
revision supersession, leveling, and the deterministic anomaly rules to produce
the comparison.

This module contains no AI-vendor-specific code and no pricing rules of its own
-- it only orchestrates src/intake, src/extraction, src/resolution, src/ai,
src/normalization, src/comparison, and src/persistence.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import jsonschema

from src.ai.provider import AIProvider, ExtractionResult
from src.comparison.adjustments import load_adjustments
from src.comparison.anomalies import load_required_scope, run_all
from src.comparison.compare import PackageComparison, build_comparison
from src.comparison.revisions import apply_supersession, diff_all
from src.extraction.excel_tables import extract_sheets
from src.extraction.hashing import sha256_file
from src.extraction.pdf_text import PageText, extract_pages
from src.intake.email_event import Attachment, EmailEvent, load_email_event
from src.normalization.normalize import NormalizedBid, normalize_extraction
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
    normalized: NormalizedBid
    pages: list[PageText]
    source_document_filename: str
    source_document_sha256: str
    revision_label: str


def _extract_pages_for(attachment: Attachment) -> list[PageText]:
    """Deterministic structural extraction, dispatched on file type."""
    if attachment.is_pdf:
        return extract_pages(attachment.path)
    if attachment.is_excel:
        return extract_sheets(attachment.path)
    raise ValueError(
        f"No deterministic extractor for {attachment.filename} "
        f"(content_type={attachment.content_type}). Add one in src/extraction/ before ingesting it."
    )


def _persist(
    session,
    event: EmailEvent,
    attachment: Attachment,
    sha256: str,
    bid_package,
    vendor,
    extraction: ExtractionResult,
    prompt_version: str,
):
    source_document = models.SourceDocument(
        filename=attachment.filename,
        sha256=sha256,
        source_type="vendor_proposal",
    )
    session.add(source_document)
    session.flush()

    bid = models.Bid(
        project_number=bid_package.project_number,
        bid_package_number=bid_package.bid_package_number,
        vendor_id=vendor.vendor_id,
        source_document_id=source_document.id,
        base_bid=extraction.base_bid,
        revision_label=event.revision_label,
        drawing_revision_referenced=extraction.drawing_revision_referenced,
    )
    session.add(bid)
    session.flush()

    for item in extraction.line_items:
        session.add(models.BidLineItem(
            bid_id=bid.id, description=item["description"], amount=item["amount"],
        ))

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

    return source_document, bid, ai_inference


def run_single(
    email_fixture_path: Path,
    repo_root: Path,
    schemas_dir: Path,
    provider: AIProvider,
    engine,
    prompt_version: str = "extract_bid_v1",
) -> PipelineResult:
    event = load_email_event(email_fixture_path, repo_root)
    attachment = event.attachments[0]
    if not attachment.path.exists():
        raise FileNotFoundError(f"Attachment referenced by {email_fixture_path} not found at {attachment.path}")

    sha256 = sha256_file(attachment.path)
    pages = _extract_pages_for(attachment)

    bid_package = resolve_bid_package(event.project_number, event.bid_package_number, repo_root / "sample-data")
    vendor = resolve_vendor(event.vendor_name, repo_root / "sample-data")

    extraction = provider.extract_bid(
        pages,
        prompt_version=prompt_version,
        email_body=event.body_text if event.pricing_in_body else "",
        document_key=attachment.filename,
    )

    schema = json.loads((schemas_dir / "bid.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(extraction.as_schema_payload(), schema)

    with session_scope(engine) as session:
        source_document, bid, ai_inference = _persist(
            session, event, attachment, sha256, bid_package, vendor, extraction, prompt_version,
        )
        result = PipelineResult(
            bid_id=bid.id,
            source_document_id=source_document.id,
            ai_inference_id=ai_inference.id,
            project_number=bid_package.project_number,
            bid_package_number=bid_package.bid_package_number,
            vendor_name=vendor.name,
            vendor_id=vendor.vendor_id,
            extraction=extraction,
            normalized=normalize_extraction(
                extraction,
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.name,
                revision_label=event.revision_label,
                source_document_filename=attachment.filename,
                bid_id=bid.id,
            ),
            pages=pages,
            source_document_filename=source_document.filename,
            source_document_sha256=source_document.sha256,
            revision_label=event.revision_label,
        )

    return result


# Backwards-compatible alias -- `run` was the single-submission entry point
# before the package-level pipeline existed.
run = run_single


@dataclass
class PackageResult:
    comparison: PackageComparison
    results: list[PipelineResult]
    bids: list[NormalizedBid]


def run_package(
    email_fixture_paths: list[Path],
    repo_root: Path,
    schemas_dir: Path,
    provider: AIProvider,
    engine,
    project_number: str,
    bid_package_number: str,
    prompt_version: str = "extract_bid_v1",
) -> PackageResult:
    """Extract every submission in a package, then level and compare them.

    Fixture paths are expected in submission order so revision supersession
    resolves correctly.
    """
    sample_data = repo_root / "sample-data"

    results = [
        run_single(path, repo_root, schemas_dir, provider, engine, prompt_version)
        for path in email_fixture_paths
    ]
    bids = apply_supersession([r.normalized for r in results])

    bid_package = resolve_bid_package(project_number, bid_package_number, sample_data)
    project = json.loads((sample_data / "projects" / f"{project_number}.json").read_text(encoding="utf-8"))
    budget = next(
        bp["budget_usd"] for bp in project["bid_packages"]
        if bp["bid_package_number"] == bid_package_number
    )

    adjustment_set = load_adjustments(sample_data / "adjustments" / f"{bid_package_number}.json")
    comparison = build_comparison(
        bids, adjustment_set, project_number, bid_package_number, budget,
    )

    required_scope = load_required_scope(
        sample_data / "specifications" / f"{project_number}-div26-required-scope.json"
    )
    comparison.anomalies = run_all(
        comparison, bids, required_scope, bid_package.drawing_revision,
    )
    comparison.revision_diffs = diff_all(bids)

    # Persist supersession so the database reflects which bids are still in play.
    with session_scope(engine) as session:
        for bid in bids:
            if bid.superseded_by and bid.bid_id:
                row = session.get(models.Bid, bid.bid_id)
                if row is not None:
                    row.superseded_by = bid.superseded_by

    return PackageResult(comparison=comparison, results=results, bids=bids)


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
    lines.append(f"  Revision: {result.revision_label}")

    lines.append("\n[AI INTERPRETATION]  "
                 f"(provider={result.extraction.provider}, model={result.extraction.model}, "
                 f"confidence={result.extraction.confidence_tier})")
    lines.append(f"  Base Bid: ${result.extraction.base_bid:,.2f}")
    if result.extraction.line_items:
        lines.append(f"  Line items: {len(result.extraction.line_items)} "
                     f"totaling ${result.extraction.line_item_total:,.2f}")
    for a in result.extraction.allowances:
        lines.append(f"  Allowance: {a['name']} = ${a['amount']:,.2f} "
                      f"(included_in_base_bid={a['included_in_base_bid']})")
    for a in result.extraction.alternates:
        lines.append(f"  Alternate {a['id']}: ${a['amount']:,.2f} "
                      f"(included_in_base_bid={a['included_in_base_bid']})")
    if result.extraction.drawing_revision_referenced:
        lines.append(f"  Drawings referenced: {result.extraction.drawing_revision_referenced}")

    lines.append("\n[SOURCE CITATIONS]")
    for field_name, citation in result.extraction.citations.items():
        lines.append(f"  {field_name} -> page {citation['page']}, \"{citation['section']}\"")

    lines.append(f"\n[LINEAGE]  bid_id={result.bid_id}  ai_inference_id={result.ai_inference_id}")
    lines.append("=" * 78)
    return "\n".join(lines)
