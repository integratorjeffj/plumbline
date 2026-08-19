"""The evaluation harness itself.

The harness is what will be quoted in a README, so it has to be trustworthy in
the same way the pipeline is. In particular it must not be able to score the
wrong document and report a clean number.
"""

import json

import pytest

from eval.run_eval import (
    FIXTURE_GOLDEN_MAP,
    PACKAGE_GOLDEN,
    EvaluationRun,
    FixtureScore,
    as_json,
    build_provider,
    categorize,
    main,
    run_evaluation,
)
from tests.conftest import SUBMISSION_ORDER


# --------------------------------------------------------------------------
# Fixture / golden mapping
# --------------------------------------------------------------------------

def test_the_map_covers_every_submission_in_order():
    """Supersession is resolved by sequence, so the order has to match."""
    assert [name for name, _ in FIXTURE_GOLDEN_MAP] == SUBMISSION_ORDER


def test_ironclad_scores_the_revision_and_not_the_superseded_original():
    """The reason the map is explicit rather than matched on vendor name.

    Ironclad submits twice. Its golden file describes Revision 1 at $179,750;
    the original is a different document at $184,300. Resolving by name would
    silently score the superseded one and under-report accuracy.
    """
    by_fixture = dict(FIXTURE_GOLDEN_MAP)
    assert by_fixture["ironclad_power_bid_received.json"] is None
    assert by_fixture["ironclad_power_revision_received.json"] == "ironclad_rev1.json"


def test_every_named_golden_file_exists(golden_dir):
    for _, golden_name in FIXTURE_GOLDEN_MAP:
        if golden_name is not None:
            assert (golden_dir / golden_name).exists(), golden_name
    assert (golden_dir / PACKAGE_GOLDEN).exists()


def test_the_superseded_submission_has_no_answer_key(golden_dir):
    """Nothing in eval/golden/ should describe the original Ironclad bid."""
    for path in golden_dir.glob("*.json"):
        golden = json.loads(path.read_text(encoding="utf-8"))
        if golden.get("vendor_id") == "ironclad-power":
            assert golden["base_bid"] == 179750.00, f"{path.name} scores the wrong revision"


# --------------------------------------------------------------------------
# Offline run
# --------------------------------------------------------------------------

def test_offline_run_scores_the_full_golden_set():
    run = run_evaluation(live=False)
    assert run.error is None
    assert run.provider == "fake"
    assert run.total == 113
    assert run.passed == 113
    assert run.accuracy_pct == 100.0


def test_offline_run_scores_four_submissions_plus_the_package():
    run = run_evaluation(live=False)
    assert len(run.fixtures) == 4
    assert len(run.package_checks) == 55


def test_scope_assertions_are_reported_as_their_own_category():
    """The hard judgment must not be averaged into the easy field reads."""
    run = run_evaluation(live=False)
    categories = run.by_category()
    assert "scope_assertions" in categories
    assert categories["scope_assertions"][1] == 18


def test_a_clean_run_reports_no_failures():
    assert run_evaluation(live=False).failures() == []


# --------------------------------------------------------------------------
# Categorization
# --------------------------------------------------------------------------

@pytest.mark.parametrize(("check_name", "expected"), [
    ("scope:arc_flash_study", "scope_assertions"),
    ("citation_present:base_bid", "citations"),
    ("allowance:Lighting fixture allowance", "allowances"),
    ("alternate:A1", "alternates"),
    ("submitted_rank:apex-electrical", "package_ranking"),
    ("adjusted_rank:apex-electrical", "package_ranking"),
    ("anomaly_present:arithmetic_discrepancy", "package_findings"),
    ("anomaly_absent:pricing_outlier_low", "package_findings"),
    ("base_bid", "extracted_fields"),
    ("drawing_revision_referenced", "extracted_fields"),
])
def test_checks_are_bucketed_by_kind(check_name, expected):
    assert categorize(check_name) == expected


# --------------------------------------------------------------------------
# Provider selection
# --------------------------------------------------------------------------

def test_offline_is_the_default_and_needs_no_key():
    provider, name, model = build_provider(live=False, model=None)
    assert name == "fake"
    assert model == "recorded"
    assert provider is not None


def test_a_live_run_without_a_key_explains_what_to_do(monkeypatch):
    """The failure mode a first-time user will hit, so it has to be readable."""
    monkeypatch.setattr("src.config.has_anthropic_key", lambda: False)

    with pytest.raises(SystemExit) as excinfo:
        build_provider(live=True, model=None)

    message = str(excinfo.value)
    assert "ANTHROPIC_API_KEY" in message
    assert ".env" in message
    assert "costs nothing" in message


def test_a_live_run_uses_the_requested_model(monkeypatch):
    monkeypatch.setattr("src.config.has_anthropic_key", lambda: True)
    monkeypatch.setattr("src.config.ANTHROPIC_API_KEY", "test-key-not-real")

    _, name, model = build_provider(live=True, model="claude-opus-5")
    assert name == "anthropic"
    assert model == "claude-opus-5"


# --------------------------------------------------------------------------
# Failure reporting
# --------------------------------------------------------------------------

def test_a_broken_run_is_reported_rather_than_raised(monkeypatch):
    """Schema-invalid model output is an evaluation result, not a crash."""
    def explode(*args, **kwargs):
        raise ValueError("simulated schema rejection")

    monkeypatch.setattr("src.pipeline.run_package", explode)

    run = run_evaluation(live=False)
    assert run.error is not None
    assert "simulated schema rejection" in run.error
    assert run.total == 0


def test_json_report_carries_the_numbers_and_the_failures():
    payload = as_json(run_evaluation(live=False))
    assert payload["provider"] == "fake"
    assert payload["accuracy_pct"] == 100.0
    assert payload["by_category"]["scope_assertions"] == {"passed": 18, "total": 18}
    assert [f["vendor"] for f in payload["fixtures"]]
    assert payload["failures"] == []


def test_json_report_is_serializable():
    json.dumps(as_json(run_evaluation(live=False)))


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def test_cli_exits_zero_on_a_clean_offline_run(capsys):
    assert main([]) == 0
    assert "113/113 checks passed" in capsys.readouterr().out


def test_cli_refuses_to_compare_a_recorded_run_against_itself():
    with pytest.raises(SystemExit) as excinfo:
        main(["--compare"])
    assert excinfo.value.code == 2


def test_cli_writes_a_json_report(tmp_path, capsys):
    out = tmp_path / "report.json"
    assert main(["--json", str(out)]) == 0
    capsys.readouterr()
    assert json.loads(out.read_text(encoding="utf-8"))["accuracy_pct"] == 100.0


def test_cli_exits_nonzero_when_checks_fail(monkeypatch, capsys):
    """A failing evaluation has to be detectable from a shell, not just readable."""
    def half_failing(*args, **kwargs):
        return EvaluationRun(
            provider="fake",
            model="recorded",
            fixtures=[FixtureScore(
                fixture="f.json", golden="g.json", vendor="Test Electric",
                checks=[type("C", (), {"name": "base_bid", "passed": False,
                                       "expected": 1, "actual": 2})()],
            )],
        )

    monkeypatch.setattr("eval.run_eval.run_evaluation", half_failing)
    assert main([]) == 1
    assert "1 failing check(s)" in capsys.readouterr().out
