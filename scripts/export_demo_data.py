"""Export real pipeline output as JSON for the public demo page and console.

The demo at index.html shows actual computed output, not hand-typed numbers.
Running this regenerates demo/projects/falcon-medical.json from the same code
path the tests exercise, so the published page can never quietly drift away
from what the pipeline really produces.

    python scripts/export_demo_data.py

Then re-inline demo/projects/falcon-medical.json into index.html (the page
embeds its data so it works with zero network requests). The console reads
every file under demo/projects/ directly (see web/scripts/sync-data.mjs) --
Falcon Medical is the one Python-derived project; other demo projects in that
directory are hand-authored, see web/scripts/build-demo-projects.ts.
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
OUTPUT_PATH = REPO_ROOT / "demo" / "projects" / "falcon-medical.json"

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
    for result, fixture_name in zip(package.results, SUBMISSION_ORDER):
        # The review screen shows the real document beside the extraction, so the
        # source text ships with the data. Without it a reviewer would be asked to
        # approve figures they cannot see the origin of, which defeats the point.
        event = json.loads(
            (REPO_ROOT / "sample-data" / "emails" / fixture_name).read_text(encoding="utf-8")
        )

        submissions.append({
            "vendor_id": result.vendor_id,
            "vendor_name": result.vendor_name,
            "revision_label": result.revision_label,
            "filename": result.source_document_filename,
            "format": FORMAT_LABELS.get(result.source_document_filename, "Document"),
            "sha256": result.source_document_sha256,
            "page_count": len(result.pages),
            "page_text": [
                {"page_number": p.page_number, "text": p.text} for p in result.pages
            ],
            "email": {
                "subject": event["subject"],
                "sender_name": event["from"]["name"],
                "sender_email": event["from"]["email"],
                "received_at": event["received_at"],
                "body_text": event.get("body_text", ""),
                "pricing_in_body": event.get("pricing_in_body", False),
            },
            "base_bid": result.extraction.base_bid,
            "line_items": result.extraction.line_items,
            "line_item_count": len(result.extraction.line_items),
            # Null, not zero: a lump-sum bid has no breakdown to reconcile,
            # which is different from a breakdown that sums to nothing.
            "line_item_total": (
                result.extraction.line_item_total if result.extraction.line_items else None
            ),
            "scope_assertions": result.extraction.scope_assertions,
            "drawing_revision_referenced": result.extraction.drawing_revision_referenced,
            "confidence_tier": result.extraction.confidence_tier,
            "provider": result.extraction.provider,
            "model": result.extraction.model,
            "prompt_version": "extract_bid_v1",
            "review_status": "pending",
            "citations": result.extraction.citations,
            "allowances": result.extraction.allowances,
            "alternates": result.extraction.alternates,
            "bid_id": result.bid_id,
            "ai_inference_id": result.ai_inference_id,
            "superseded": not result.normalized.is_active,
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

    def gate_payload(gate):
        return {
            "code": gate.code,
            "label": gate.label,
            "status": gate.status,
            "summary": gate.summary,
            "detail": gate.detail,
        }

    prequalification = {
        vendor_id: {
            "vendor_id": result.vendor_id,
            "vendor_name": result.vendor_name,
            "eligible": result.eligible,
            "status": result.status,
            "disqualifying_reason": result.disqualifying_reason,
            "emr": result.emr,
            "last_reviewed": result.last_reviewed,
            "bond_utilization_pct": result.bond_utilization_pct,
            "participation_certifications": result.participation_certifications,
            "gates": [gate_payload(g) for g in result.gates],
            "safety": result.safety,
            "bonding": result.bonding,
            "insurance": result.insurance,
            "certifications": result.certifications,
            "performance": result.performance,
            "schedule": result.schedule,
        }
        for vendor_id, result in package.prequalification.items()
    }

    coverage = None
    if package.coverage is not None:
        cov = package.coverage
        coverage = {
            "issued_date": cov.issued_date,
            "bids_due": cov.bids_due,
            "invited_count": cov.invited_count,
            "responded_count": len(cov.responded),
            "declined_count": len(cov.declined),
            "no_response_count": len(cov.no_response),
            "response_rate_pct": cov.response_rate_pct,
            "health": cov.health,
            "minimum_bidders": cov.minimum_bidders,
            "target_bidders": cov.target_bidders,
            "current_addendum": cov.current_addendum,
            "invitations": [
                {"vendor_id": i.vendor_id, "vendor_name": i.vendor_name,
                 "invited_at": i.invited_at, "status": i.status, "note": i.note}
                for i in cov.invitations
            ],
            "acknowledgments": [
                {"vendor_id": a.vendor_id, "vendor_name": a.vendor_name,
                 "drawing_revision_referenced": a.drawing_revision_referenced,
                 "acknowledged_through": a.acknowledged_through,
                 "missing_addenda": a.missing_addenda,
                 "acknowledged": a.acknowledged, "unstated": a.unstated}
                for a in cov.acknowledgments
            ],
            "addenda": json.loads(
                (REPO_ROOT / "sample-data" / "addenda" / f"{BID_PACKAGE_NUMBER}.json")
                .read_text(encoding="utf-8")
            )["addenda"],
        }

    # The award baseline ships at the default weighting so the console can verify
    # its own re-implementation against it, the same way leveling parity works.
    award = None
    if package.award is not None:
        def score_payload(score):
            return {
                "vendor_id": score.vendor_id,
                "vendor_name": score.vendor_name,
                "adjusted_total": score.adjusted_total,
                "submitted_total": score.submitted_total,
                "total_score": score.total_score,
                "eligible": score.eligible,
                "disqualifying_reason": score.disqualifying_reason,
                "rank": score.rank,
                "factors": [
                    {"factor": f.factor, "label": f.label, "score": f.score,
                     "weight": f.weight, "weighted": f.weighted, "basis": f.basis,
                     "detail": f.detail}
                    for f in score.factors
                ],
            }

        award = {
            "weights": package.award.weights,
            "scores": [score_payload(s) for s in package.award.scores],
            "recommended_vendor_id": (
                package.award.recommended.vendor_id if package.award.recommended else None
            ),
            "runner_up_vendor_id": (
                package.award.runner_up.vendor_id if package.award.runner_up else None
            ),
            "margin": package.award.margin,
            "agrees_with_lowest_leveled": package.award.agrees_with_lowest_leveled,
            "narrative": package.award.narrative,
        }

    company = json.loads(
        (REPO_ROOT / "sample-data" / "company" / "crestmark.json").read_text(encoding="utf-8")
    )
    project_record = json.loads(
        (REPO_ROOT / "sample-data" / "projects" / f"{PROJECT_NUMBER}.json").read_text(encoding="utf-8")
    )
    package_record = next(
        bp for bp in project_record["bid_packages"]
        if bp["bid_package_number"] == BID_PACKAGE_NUMBER
    )

    required_scope = load_required_scope(
        REPO_ROOT / "sample-data" / "specifications" / f"{PROJECT_NUMBER}-div26-required-scope.json"
    )

    # The settings screen lets the estimator retune these, so the rules ship
    # with their provenance attached rather than as bare numbers.
    adjustment_file = json.loads(
        (REPO_ROOT / "sample-data" / "adjustments" / f"{BID_PACKAGE_NUMBER}.json")
        .read_text(encoding="utf-8")
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
        "prequalification": prequalification,
        "coverage": coverage,
        "award": award,
        "policy": {
            "prequalification": company["subcontractor_prequalification_policy"],
            "coverage": company["bid_coverage_policy"],
            "schedule_requirement": package_record["schedule_requirement"],
            "evaluation_date": package_record["evaluation_date"],
        },
        "adjustment_rules": {
            "entered_by": adjustment_file["entered_by"],
            "entered_role": adjustment_file.get("entered_role", ""),
            "source": adjustment_file["source"],
            "rules": adjustment_file["adjustments"],
        },
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
