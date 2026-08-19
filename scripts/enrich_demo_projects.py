"""Add eligibility and award reasoning to the hand-authored demo packages.

Falcon Medical gets prequalification, coverage, and the award model for free:
it runs through the real Python pipeline, which composes all three
(src/pipeline.py). The other demo packages do not. They are hand-authored seeds
built by web/scripts/build-demo-projects.ts, which runs them through the
TypeScript leveling and findings engines and stops there.

That left two thirds of the console showing empty states on the
Prequalification and Award pages -- honest, but only because nobody had
authored the records, which is a different thing from a capability that does
not exist.

This script closes that gap without porting the gates to TypeScript. It reads
the already-built project JSON, rebuilds the handful of pipeline objects the
evaluators need, and runs the SAME Python engines Falcon uses. So all three
packages are scored by one implementation, and there is no second copy of the
gate rules to drift.

    python scripts/export_demo_data.py        # Falcon, via the real pipeline
    npx tsx web/scripts/build-demo-projects.ts  # the seed packages
    python scripts/enrich_demo_projects.py    # this, over the seed packages

Re-running is safe: the derived keys are replaced outright and the findings
this script contributes are stripped before being recomputed.
"""

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src.comparison.anomalies import SEVERITY_ORDER  # noqa: E402
from src.comparison.award import recommend_award  # noqa: E402
from src.comparison.compare import PackageComparison, VendorComparison  # noqa: E402
from src.comparison.coverage import (  # noqa: E402
    build_coverage,
    load_addenda,
    load_itb,
)
from src.comparison.coverage import run_all as run_coverage_rules  # noqa: E402
from src.comparison.prequalification import (  # noqa: E402
    evaluate_package,
    load_policy,
    load_vendor_records,
)
from src.normalization.normalize import NormalizedBid  # noqa: E402

SAMPLE_DATA = REPO_ROOT / "sample-data"
PROJECTS_DIR = REPO_ROOT / "demo" / "projects"

# Falcon Medical is produced by the real pipeline and already carries all of
# this. Enriching it here would overwrite pipeline output with a reconstruction
# of itself, which is exactly the kind of quiet second source of truth the
# project avoids everywhere else.
TARGETS = {
    "harborview-mechanical": "27-0212",
    "westbrook-electrical": "28-0355",
}

# Codes this script contributes, stripped before recompute so re-runs do not
# accumulate duplicates.
COVERAGE_CODES = {
    "coverage_below_minimum",
    "coverage_thin",
    "invitation_no_response",
    "addenda_not_acknowledged",
    "addenda_acknowledgment_unstated",
}


def rebuild_comparison(data: dict, project_number: str) -> PackageComparison:
    """Reconstruct the comparison object the award model expects.

    Only the fields the award model actually reads are populated. Inventing
    plausible values for the rest would make this look like a pipeline run when
    it is a reconstruction of one.
    """
    vendors = [
        VendorComparison(
            vendor_id=v["vendor_id"],
            vendor_name=v["vendor_name"],
            revision_label=v["revision_label"],
            submitted_total=v["submitted_total"],
            adjusted_total=v["adjusted_total"],
            submitted_rank=v["submitted_rank"],
            adjusted_rank=v["adjusted_rank"],
            confidence_tier=v["confidence_tier"],
        )
        for v in data["vendors"]
    ]

    return PackageComparison(
        project_number=project_number,
        bid_package_number=data["project"]["bid_package_number"],
        budget=data["project"]["budget"],
        vendors=vendors,
        scope_matrix={item["key"]: item["statuses"] for item in data["scope_items"]},
        adjustments_entered_by=data["adjustment_rules"]["entered_by"],
    )


def rebuild_bids(data: dict) -> list[NormalizedBid]:
    """Enough of each submission for addendum acknowledgment to be resolved."""
    return [
        NormalizedBid(
            vendor_id=s["vendor_id"],
            vendor_name=s["vendor_name"],
            revision_label=s["revision_label"],
            submitted_total=s["base_bid"],
            scope=s["scope_assertions"],
            drawing_revision_referenced=s.get("drawing_revision_referenced"),
            superseded_by="superseded" if s.get("superseded") else None,
        )
        for s in data["submissions"]
    ]


def gate_payload(gate) -> dict:
    return {"code": gate.code, "label": gate.label, "status": gate.status,
            "summary": gate.summary, "detail": gate.detail}


def prequal_payload(result) -> dict:
    return {
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


def coverage_payload(coverage, addenda: dict) -> dict:
    return {
        "issued_date": coverage.issued_date,
        "bids_due": coverage.bids_due,
        "invited_count": coverage.invited_count,
        "responded_count": len(coverage.responded),
        "declined_count": len(coverage.declined),
        "no_response_count": len(coverage.no_response),
        "response_rate_pct": coverage.response_rate_pct,
        "health": coverage.health,
        "minimum_bidders": coverage.minimum_bidders,
        "target_bidders": coverage.target_bidders,
        "current_addendum": coverage.current_addendum,
        "invitations": [
            {"vendor_id": i.vendor_id, "vendor_name": i.vendor_name,
             "invited_at": i.invited_at, "status": i.status, "note": i.note}
            for i in coverage.invitations
        ],
        "acknowledgments": [
            {"vendor_id": a.vendor_id, "vendor_name": a.vendor_name,
             "drawing_revision_referenced": a.drawing_revision_referenced,
             "acknowledged_through": a.acknowledged_through,
             "missing_addenda": a.missing_addenda,
             "acknowledged": a.acknowledged, "unstated": a.unstated}
            for a in coverage.acknowledgments
        ],
        "addenda": addenda["addenda"],
    }


def award_payload(award) -> dict:
    return {
        "weights": award.weights,
        "scores": [
            {
                "vendor_id": s.vendor_id,
                "vendor_name": s.vendor_name,
                "adjusted_total": s.adjusted_total,
                "submitted_total": s.submitted_total,
                "total_score": s.total_score,
                "eligible": s.eligible,
                "disqualifying_reason": s.disqualifying_reason,
                "rank": s.rank,
                "factors": [
                    {"factor": f.factor, "label": f.label, "score": f.score,
                     "weight": f.weight, "weighted": f.weighted, "basis": f.basis,
                     "detail": f.detail}
                    for f in s.factors
                ],
            }
            for s in award.scores
        ],
        "recommended_vendor_id": award.recommended.vendor_id if award.recommended else None,
        "runner_up_vendor_id": award.runner_up.vendor_id if award.runner_up else None,
        "margin": award.margin,
        "agrees_with_lowest_leveled": award.agrees_with_lowest_leveled,
        "narrative": award.narrative,
    }


def enrich(slug: str, project_number: str) -> None:
    project_path = PROJECTS_DIR / f"{slug}.json"
    data = json.loads(project_path.read_text(encoding="utf-8"))

    project_record = json.loads(
        (SAMPLE_DATA / "projects" / f"{project_number}.json").read_text(encoding="utf-8")
    )
    bid_package_number = data["project"]["bid_package_number"]
    package_record = next(
        bp for bp in project_record["bid_packages"]
        if bp["bid_package_number"] == bid_package_number
    )

    company_path = SAMPLE_DATA / "company" / f"{project_record['general_contractor_id']}.json"
    company = json.loads(company_path.read_text(encoding="utf-8"))
    policy = load_policy(company_path)

    comparison = rebuild_comparison(data, project_number)
    bids = rebuild_bids(data)

    prequalification = evaluate_package(
        load_vendor_records(SAMPLE_DATA / "vendors"),
        policy,
        {v.vendor_id: v.adjusted_total for v in comparison.vendors},
        date.fromisoformat(package_record["evaluation_date"]),
    )

    missing = {v.vendor_id for v in comparison.vendors} - set(prequalification)
    if missing:
        raise SystemExit(
            f"\n  {slug}: no prequalification record for {', '.join(sorted(missing))}.\n"
            f"  Add sample-data/vendors/<vendor_id>.json with a prequalification block.\n"
        )

    addenda = load_addenda(SAMPLE_DATA / "addenda" / f"{bid_package_number}.json")
    coverage = build_coverage(
        load_itb(SAMPLE_DATA / "itb" / f"{bid_package_number}.json"),
        addenda,
        bids,
        company["bid_coverage_policy"],
    )

    award = recommend_award(
        comparison, prequalification, policy, package_record["schedule_requirement"]
    )

    findings = [f for f in data["findings"] if f["code"] not in COVERAGE_CODES]
    findings += [
        {"code": a.code, "severity": a.severity, "summary": a.summary,
         "vendor_id": a.vendor_id, "vendor_name": a.vendor_name, "detail": a.detail}
        for a in run_coverage_rules(coverage)
    ]
    data["findings"] = sorted(findings, key=lambda f: (SEVERITY_ORDER[f["severity"]], f["code"]))
    data["summary"]["high_severity_findings"] = sum(
        1 for f in data["findings"] if f["severity"] == "HIGH"
    )

    data["prequalification"] = {k: prequal_payload(v) for k, v in prequalification.items()}
    data["coverage"] = coverage_payload(coverage, addenda)
    data["award"] = award_payload(award)
    data["policy"] = {
        "prequalification": company["subcontractor_prequalification_policy"],
        "coverage": company["bid_coverage_policy"],
        "schedule_requirement": package_record["schedule_requirement"],
        "evaluation_date": package_record["evaluation_date"],
    }

    project_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    eligible = sum(1 for v in prequalification.values() if v.eligible)
    recommended = award.recommended.vendor_name if award.recommended else "none"
    print(f"  {slug}: {eligible}/{len(prequalification)} eligible, "
          f"coverage {coverage.health} ({len(coverage.responded)}/{coverage.invited_count}), "
          f"recommends {recommended}")


def main() -> int:
    for slug, project_number in TARGETS.items():
        enrich(slug, project_number)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
