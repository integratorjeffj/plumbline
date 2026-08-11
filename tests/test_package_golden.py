"""The package-level golden evaluation, run deterministically via FakeProvider.

This is the Milestone 2 equivalent of tests/test_pipeline_golden.py: the whole
four-vendor pipeline against a hand-authored answer key, in CI, with no live
model call (Amendment 4).
"""

from eval.run_eval import compare_package, load_golden


def test_package_comparison_passes_every_golden_check(package_result, golden_package_path):
    golden = load_golden(golden_package_path)
    checks = compare_package(package_result.comparison, golden)
    failed = [(c.name, c.expected, c.actual) for c in checks if not c.passed]
    assert not failed, f"Golden checks failed: {failed}"


def test_golden_file_covers_every_active_vendor(package_result, golden_package_path):
    golden = load_golden(golden_package_path)
    golden_ids = {entry["vendor_id"] for entry in golden["submitted_ranking"]}
    assert golden_ids == {v.vendor_id for v in package_result.comparison.vendors}


def test_every_extraction_validates_against_the_bid_schema(package_result, schemas_dir):
    import json

    import jsonschema

    schema = json.loads((schemas_dir / "bid.schema.json").read_text(encoding="utf-8"))
    for result in package_result.results:
        jsonschema.validate(result.extraction.as_schema_payload(), schema)


def test_every_submission_has_an_ai_inference_lineage_record(package_result):
    assert len(package_result.results) == 5
    for result in package_result.results:
        assert result.ai_inference_id
        assert result.source_document_sha256
        assert result.extraction.confidence_tier in ("HIGH", "REVIEW", "LOW")


def test_each_source_document_hash_is_distinct(package_result):
    hashes = [r.source_document_sha256 for r in package_result.results]
    assert len(set(hashes)) == len(hashes)
