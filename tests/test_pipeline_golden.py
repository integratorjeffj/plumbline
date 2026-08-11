"""Full pipeline, run deterministically via FakeProvider (Amendment 4:
software CI never depends on a live model call).

Covers: fixture/schema validity end-to-end, document hashing, PDF
extraction, project/vendor resolution, exact base-bid value, golden
scope statuses, and citation presence -- the full acceptance-criteria
list from docs/fixtures/apex-electrical-fixture-spec.md.
"""

import json

from src.ai.fake_provider import FakeProvider
from src.persistence.db import init_db
from src.pipeline import run
from eval.run_eval import compare, load_golden


def _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    engine = init_db(tmp_path / "test_bid_intel.db")
    return run(
        email_fixture_path=apex_email_fixture_path,
        repo_root=repo_root,
        schemas_dir=schemas_dir,
        provider=FakeProvider(),
        engine=engine,
    )


def test_pipeline_produces_exact_golden_base_bid(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    result = _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path)
    assert result.extraction.base_bid == 191850.00


def test_pipeline_resolves_correct_project_and_vendor(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    result = _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path)
    assert result.project_number == "26-0147"
    assert result.bid_package_number == "26-0147-BP-26"
    assert result.vendor_name == "Apex Electrical Contractors"


def test_pipeline_produces_golden_scope_statuses(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    result = _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path)
    assert result.extraction.scope_assertions["electrical_permit_fees"] == "Included"
    assert result.extraction.scope_assertions["performance_payment_bond"] == "Excluded"
    # NotFound, not Excluded -- the distinction the whole product depends on (charter Section 9).
    assert result.extraction.scope_assertions["arc_flash_study"] == "NotFound"


def test_pipeline_produces_citations_for_every_extracted_fact(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    result = _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path)
    for field_name in ("base_bid", "lighting_fixture_allowance", "alternate_a1",
                       "performance_payment_bond", "electrical_permit_fees"):
        assert field_name in result.extraction.citations
        citation = result.extraction.citations[field_name]
        assert citation["page"] >= 1
        assert citation["section"]


def test_pipeline_persists_ai_inference_lineage(repo_root, apex_email_fixture_path, schemas_dir, tmp_path):
    engine = init_db(tmp_path / "test_bid_intel.db")
    result = run(
        email_fixture_path=apex_email_fixture_path,
        repo_root=repo_root,
        schemas_dir=schemas_dir,
        provider=FakeProvider(),
        engine=engine,
    )

    from src.persistence.db import session_scope
    from src.persistence.models import AIInference, Bid

    with session_scope(engine) as session:
        bid = session.get(Bid, result.bid_id)
        assert bid is not None
        assert bid.base_bid == 191850.00

        inference = session.get(AIInference, result.ai_inference_id)
        assert inference is not None
        assert inference.provider == "fake"
        assert inference.confidence_tier == "HIGH"
        assert inference.review_status == "pending"
        assert json.loads(json.dumps(inference.source_document_ids)) == [result.source_document_id]


def test_pipeline_output_passes_golden_evaluation(repo_root, apex_email_fixture_path, schemas_dir, golden_apex_path, tmp_path):
    result = _run_pipeline_with_fake_provider(repo_root, apex_email_fixture_path, schemas_dir, tmp_path)
    golden = load_golden(golden_apex_path)
    checks = compare(result, golden)
    failed = [c for c in checks if not c.passed]
    assert not failed, f"Golden checks failed: {failed}"
