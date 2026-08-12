"""Export real pipeline output as JSON for the public demo page.

The demo at index.html shows actual computed output, not hand-typed numbers.
Running this regenerates demo/data.json from the same code path the tests
exercise, so the published page can never quietly drift away from what the
pipeline really produces.

    python scripts/export_demo_data.py

Then re-inline demo/data.json into index.html (the page embeds its data so it
works with zero network requests).
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src import config  # noqa: E402
from src.ai.fake_provider import FakeProvider  # noqa: E402
from src.comparison.anomalies import load_required_scope  # noqa: E402
from src.normalization.taxonomy import SCOPE_BY_KEY, SCOPE_KEYS, label_for  # noqa: E402
from src.persistence.db import init_db  # noqa: E402
from src.pipeline import run_package  # noqa: E402

PROJECT_NUMBER = "26-0147"
BID_PACKAGE_NUMBER = "26-0147-BP-26"
OUTPUT_PATH = REPO_ROOT / "demo" / "data.json"

SUBMISSION_ORDER = [
    "apex_electrical_bid_received.json",
    "voltage_systems_bid_received.json",
    "meridian_electric_bid_received.json",
    "ironclad_power_bid_received.json",
    "ironclad_power_revision_received.json",
]

# How each submission arrived, for the intake stage of the demo walkthrough.
FORMAT_LABELS = {
    "apex_electrical_proposal.pdf": "PDF proposal, 5 pages",
    "voltage_systems_pricing.xlsx": "Excel workbook, 4 sheets",
    "meridian_electric_scope_letter.pdf": "Pricing in email body + PDF scope letter",
    "ironclad_power_proposal.pdf": "PDF proposal, 3 pages",
    "ironclad_power_proposal_rev1.pdf": "PDF proposal, 3 pages (Revision 1)",
}


def build_payload() -> dict:
    engine = init_db(REPO_ROOT / "demo" / "_export.db")
    try:
        package = run_package(
            email_fixture_paths=[REPO_ROOT / "sample-data" / "emails" / n for n in SUBMISSION_ORDER],
            repo_root=REPO_ROOT,
            schemas_dir=config.SCHEMAS_DIR,
            provider=FakeProvider(),
            engine=engine,
            project_number=PROJECT_NUMBER,
            bid_package_number=BID_PACKAGE_NUMBER,
        )
    finally:
        # Windows will not let the scratch file be deleted while SQLAlchemy
        # still holds a pooled connection to it.
        engine.dispose()

    comparison = package.comparison

    submissions = []
    for result in package.results:
        submissions.append({
            "vendor_id": result.vendor_id,
            "vendor_name": result.vendor_name,
            "revision_label": result.revision_label,
            "filename": result.source_document_filename,
            "format": FORMAT_LABELS.get(result.source_document_filename, "Document"),
            "sha256": result.source_document_sha256,
            "pages": len(result.pages),
            "base_bid": result.extraction.base_bid,
            "line_item_count": len(result.extraction.line_items),
            # Null, not zero: a lump-sum bid has no breakdown to reconcile,
            # which is different from a breakdown that sums to nothing.
            "line_item_total": (
                result.extraction.line_item_total if result.extraction.line_items else None
            ),
            "drawing_revision_referenced": result.extraction.drawing_revision_referenced,
            "confidence_tier": result.extraction.confidence_tier,
            "provider": result.extraction.provider,
            "model": result.extraction.model,
            "citations": result.extraction.citations,
            "allowances": result.extraction.allowances,
            "alternates": result.extraction.alternates,
            "bid_id": result.bid_id,
            "ai_inference_id": result.ai_inference_id,
        })

    vendors = []
    for vendor in comparison.by_submitted_rank():
        vendors.append({
            "vendor_id": vendor.vendor_id,
            "vendor_name": vendor.vendor_name,
            "revision_label": vendor.revision_label,
            "submitted_total": vendor.submitted_total,
            "adjusted_total": vendor.adjusted_total,
            "submitted_rank": vendor.submitted_rank,
            "adjusted_rank": vendor.adjusted_rank,
            "rank_movement": vendor.rank_movement,
            "leveling_delta": vendor.leveling_delta,
            "leveling_delta_pct": vendor.leveling_delta_pct,
            "confidence_tier": vendor.confidence_tier,
            "unclear_scope_keys": vendor.unclear_scope_keys,
            "adjustments": [
                {
                    "scope_key": a.scope_key,
                    "label": a.label,
                    "status": a.status,
                    "amount": a.amount,
                    "rationale": a.rationale,
                }
                for a in vendor.adjustments
            ],
        })

    required_scope = load_required_scope(
        REPO_ROOT / "sample-data" / "specifications" / f"{PROJECT_NUMBER}-div26-required-scope.json"
    )

    return {
        "project": {
            "project_number": comparison.project_number,
            "project_name": "Falcon Medical Center Expansion",
            "customer": "Falcon Health Partners",
            "bid_package_number": comparison.bid_package_number,
            "bid_package_description": "Division 26 - Electrical",
            "budget": comparison.budget,
            "drawing_revision": "Rev 3",
            "general_contractor": "Crestmark Construction Partners",
            "estimator": comparison.adjustments_entered_by,
        },
        "submissions": submissions,
        "vendors": vendors,
        "scope_items": [
            {
                "key": key,
                "label": label_for(key),
                "in_package_scope": SCOPE_BY_KEY[key].in_package_scope,
                "statuses": comparison.scope_matrix[key],
            }
            for key in SCOPE_KEYS
        ],
        "required_scope": required_scope,
        "findings": [
            {
                "code": a.code,
                "severity": a.severity,
                "summary": a.summary,
                "vendor_id": a.vendor_id,
                "vendor_name": a.vendor_name,
                "detail": a.detail,
            }
            for a in comparison.anomalies
        ],
        "revisions": [
            {
                "vendor_id": d.vendor_id,
                "vendor_name": d.vendor_name,
                "previous_label": d.previous_label,
                "current_label": d.current_label,
                "previous_total": d.previous_total,
                "current_total": d.current_total,
                "total_delta": d.total_delta,
                "changes": [
                    {"label": c.label, "previous": c.previous, "current": c.current, "delta": c.delta}
                    for c in d.changes
                ],
            }
            for d in comparison.revision_diffs
        ],
        "superseded": [{"vendor_name": n, "note": note} for n, note in comparison.superseded],
        "summary": {
            "leveling_changes_the_answer": comparison.leveling_changes_the_answer,
            "lowest_submitted": comparison.lowest_submitted.vendor_name,
            "lowest_submitted_total": comparison.lowest_submitted.submitted_total,
            "lowest_adjusted": comparison.lowest_adjusted.vendor_name,
            "lowest_adjusted_total": comparison.lowest_adjusted.adjusted_total,
            "active_bidders": len(comparison.vendors),
            "documents_processed": len(package.results),
            "high_severity_findings": sum(1 for a in comparison.anomalies if a.severity == "HIGH"),
        },
    }


def main() -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload()
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # The scratch database is a build artifact, not part of the export.
    scratch_db = OUTPUT_PATH.parent / "_export.db"
    if scratch_db.exists():
        scratch_db.unlink()

    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")
    print(f"  {payload['summary']['documents_processed']} documents, "
          f"{payload['summary']['active_bidders']} active bidders, "
          f"{len(payload['findings'])} findings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
