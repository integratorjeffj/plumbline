"""Compare pipeline output against golden answer files.

This is the evaluation harness (docs/architecture-review.md Section 10): because
every fixture is authored by us, the correct answer is known ahead of time, so
extraction and comparison can be checked exactly rather than eyeballed.

`tests/` runs these comparisons in CI against FakeProvider output; a live run
against AnthropicProvider is the separate, explicitly-triggered evaluation track
required by Amendment 4.
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    # So `python eval/run_eval.py` works, not just `python -m eval.run_eval`.
    sys.path.insert(0, str(REPO_ROOT))

from src.comparison.compare import PackageComparison  # noqa: E402
from src.pipeline import PipelineResult  # noqa: E402


@dataclass
class CheckResult:
    name: str
    passed: bool
    expected: object
    actual: object


def load_golden(golden_path: Path) -> dict:
    return json.loads(Path(golden_path).read_text(encoding="utf-8"))


def _find(items: list[dict], key: str, value: str) -> dict | None:
    for item in items:
        if item.get(key) == value:
            return item
    return None


# --------------------------------------------------------------------------
# Single-vendor extraction checks
# --------------------------------------------------------------------------

def compare(result: PipelineResult, golden: dict) -> list[CheckResult]:
    checks: list[CheckResult] = []
    extraction = result.extraction

    checks.append(CheckResult("vendor_name", result.vendor_name == golden["vendor"],
                              golden["vendor"], result.vendor_name))
    checks.append(CheckResult("project_number", result.project_number == golden["project_number"],
                              golden["project_number"], result.project_number))
    checks.append(CheckResult("bid_package", result.bid_package_number == golden["bid_package"],
                              golden["bid_package"], result.bid_package_number))
    checks.append(CheckResult("base_bid", extraction.base_bid == golden["base_bid"],
                              golden["base_bid"], extraction.base_bid))

    for golden_allowance in golden.get("allowances", []):
        actual = _find(extraction.allowances, "name", golden_allowance["name"])
        name = f"allowance:{golden_allowance['name']}"
        if actual is None:
            checks.append(CheckResult(name, False, golden_allowance, None))
            continue
        passed = (
            actual["amount"] == golden_allowance["amount"]
            and actual["included_in_base_bid"] == golden_allowance["included_in_base_bid"]
        )
        checks.append(CheckResult(name, passed, golden_allowance, actual))

    for golden_alt in golden.get("alternates", []):
        actual = _find(extraction.alternates, "id", golden_alt["id"])
        name = f"alternate:{golden_alt['id']}"
        if actual is None:
            checks.append(CheckResult(name, False, golden_alt, None))
            continue
        passed = (
            actual["amount"] == golden_alt["amount"]
            and actual["included_in_base_bid"] == golden_alt["included_in_base_bid"]
        )
        checks.append(CheckResult(name, passed, golden_alt, actual))

    for scope_key, expected_status in golden.get("scope_assertions", {}).items():
        actual_status = extraction.scope_assertions.get(scope_key)
        checks.append(CheckResult(f"scope:{scope_key}", actual_status == expected_status,
                                  expected_status, actual_status))

    for field_name in golden.get("citations", {}):
        present = field_name in extraction.citations
        checks.append(CheckResult(f"citation_present:{field_name}", present,
                                  "present", "present" if present else "missing"))

    if "drawing_revision_referenced" in golden:
        expected = golden["drawing_revision_referenced"]
        actual = extraction.drawing_revision_referenced
        checks.append(CheckResult("drawing_revision_referenced", actual == expected, expected, actual))

    if "line_item_total" in golden:
        expected = golden["line_item_total"]
        actual = extraction.line_item_total
        checks.append(CheckResult("line_item_total", actual == expected, expected, actual))

    return checks


# --------------------------------------------------------------------------
# Package-level comparison checks
# --------------------------------------------------------------------------

def compare_package(comparison: PackageComparison, golden: dict) -> list[CheckResult]:
    checks: list[CheckResult] = []

    checks.append(CheckResult(
        "active_bidder_count",
        len(comparison.vendors) == golden["active_bidder_count"],
        golden["active_bidder_count"], len(comparison.vendors),
    ))

    by_id = {v.vendor_id: v for v in comparison.vendors}

    for entry in golden["submitted_ranking"]:
        vendor = by_id.get(entry["vendor_id"])
        name = f"submitted_rank:{entry['vendor_id']}"
        if vendor is None:
            checks.append(CheckResult(name, False, entry, None))
            continue
        passed = vendor.submitted_rank == entry["rank"] and vendor.submitted_total == entry["total"]
        checks.append(CheckResult(
            name, passed,
            {"rank": entry["rank"], "total": entry["total"]},
            {"rank": vendor.submitted_rank, "total": vendor.submitted_total},
        ))

    for entry in golden["adjusted_ranking"]:
        vendor = by_id.get(entry["vendor_id"])
        name = f"adjusted_rank:{entry['vendor_id']}"
        if vendor is None:
            checks.append(CheckResult(name, False, entry, None))
            continue
        passed = vendor.adjusted_rank == entry["rank"] and vendor.adjusted_total == entry["total"]
        checks.append(CheckResult(
            name, passed,
            {"rank": entry["rank"], "total": entry["total"]},
            {"rank": vendor.adjusted_rank, "total": vendor.adjusted_total},
        ))

    checks.append(CheckResult(
        "leveling_changes_the_answer",
        comparison.leveling_changes_the_answer == golden["leveling_changes_the_answer"],
        golden["leveling_changes_the_answer"], comparison.leveling_changes_the_answer,
    ))
    checks.append(CheckResult(
        "lowest_submitted_vendor",
        comparison.lowest_submitted.vendor_id == golden["lowest_submitted_vendor_id"],
        golden["lowest_submitted_vendor_id"], comparison.lowest_submitted.vendor_id,
    ))
    checks.append(CheckResult(
        "lowest_adjusted_vendor",
        comparison.lowest_adjusted.vendor_id == golden["lowest_adjusted_vendor_id"],
        golden["lowest_adjusted_vendor_id"], comparison.lowest_adjusted.vendor_id,
    ))

    found_codes = {a.code for a in comparison.anomalies}
    for code in golden["expected_anomaly_codes"]:
        checks.append(CheckResult(f"anomaly_present:{code}", code in found_codes,
                                  "present", "present" if code in found_codes else "missing"))
    for code in golden.get("not_expected_anomaly_codes", []):
        checks.append(CheckResult(f"anomaly_absent:{code}", code not in found_codes,
                                  "absent", "absent" if code not in found_codes else "present"))

    for code, expectation in golden.get("anomaly_expectations", {}).items():
        matching = [a for a in comparison.anomalies if a.code == code]

        if "vendor_ids" in expectation:
            actual_ids = sorted(a.vendor_id for a in matching if a.vendor_id)
            expected_ids = sorted(expectation["vendor_ids"])
            checks.append(CheckResult(f"anomaly_vendors:{code}", actual_ids == expected_ids,
                                      expected_ids, actual_ids))

        if "scope_keys" in expectation:
            actual_keys = sorted(a.detail.get("scope_key") for a in matching if a.detail.get("scope_key"))
            expected_keys = sorted(expectation["scope_keys"])
            checks.append(CheckResult(f"anomaly_scope_keys:{code}", actual_keys == expected_keys,
                                      expected_keys, actual_keys))

        if "detail" in expectation and matching:
            actual_detail = matching[0].detail
            for detail_key, expected_value in expectation["detail"].items():
                actual_value = actual_detail.get(detail_key)
                checks.append(CheckResult(
                    f"anomaly_detail:{code}.{detail_key}",
                    actual_value == expected_value, expected_value, actual_value,
                ))

    for entry in golden.get("superseded_bids", []):
        matching = [
            name for name, note in comparison.superseded
            if entry["superseded_by"] in note
        ]
        checks.append(CheckResult(f"superseded:{entry['vendor_id']}", bool(matching),
                                  entry["superseded_by"], matching or "none"))

    for entry in golden.get("revision_diffs", []):
        diff = next((d for d in comparison.revision_diffs if d.vendor_id == entry["vendor_id"]), None)
        name = f"revision_diff:{entry['vendor_id']}"
        if diff is None:
            checks.append(CheckResult(name, False, entry, None))
            continue
        passed = (
            diff.previous_total == entry["previous_total"]
            and diff.current_total == entry["current_total"]
            and diff.total_delta == entry["total_delta"]
        )
        checks.append(CheckResult(
            name, passed,
            {"previous": entry["previous_total"], "current": entry["current_total"],
             "delta": entry["total_delta"]},
            {"previous": diff.previous_total, "current": diff.current_total,
             "delta": diff.total_delta},
        ))

    for scope_key, expected_row in golden.get("scope_matrix_spot_checks", {}).items():
        actual_row = comparison.scope_matrix.get(scope_key, {})
        for vendor_id, expected_status in expected_row.items():
            actual_status = actual_row.get(vendor_id)
            checks.append(CheckResult(
                f"scope_matrix:{scope_key}:{vendor_id}",
                actual_status == expected_status, expected_status, actual_status,
            ))

    return checks


def print_report(checks: list[CheckResult], title: str = "GOLDEN EVALUATION") -> bool:
    print("\n" + "-" * 78)
    print(title)
    print("-" * 78)
    all_passed = True
    for c in checks:
        status = "PASS" if c.passed else "FAIL"
        if not c.passed:
            all_passed = False
        print(f"  [{status}] {c.name}"
              + ("" if c.passed else f"  expected={c.expected!r} actual={c.actual!r}"))
    print("-" * 78)
    print(f"  {sum(c.passed for c in checks)}/{len(checks)} checks passed")
    print("-" * 78)
    return all_passed


# --------------------------------------------------------------------------
# Runner
# --------------------------------------------------------------------------
#
# `tests/` proves the deterministic half of the system against recorded model
# responses. This runner is the other track: it points the same golden answer
# key at a live model and reports how much of it the model actually gets right.
#
# The distinction matters. A green test suite says the arithmetic is correct
# given a known extraction. It says nothing about whether Claude, today, on
# this prompt, reads a scope letter the way the recordings assume. Only a live
# run answers that, which is why it is explicitly triggered and never part of
# CI (docs/architecture-review.md Section 10, Amendment 4).

# Golden files are mapped to fixtures explicitly rather than matched by vendor
# name. Ironclad submits twice, and its golden file describes the REVISION --
# resolving by name alone would silently score the superseded original.
FIXTURE_GOLDEN_MAP: list[tuple[str, str | None]] = [
    ("apex_electrical_bid_received.json", "apex.json"),
    ("voltage_systems_bid_received.json", "voltage.json"),
    ("meridian_electric_bid_received.json", "meridian.json"),
    ("ironclad_power_bid_received.json", None),  # superseded; no answer key
    ("ironclad_power_revision_received.json", "ironclad_rev1.json"),
]

PACKAGE_GOLDEN = "package_26-0147-BP-26.json"
PROJECT_NUMBER = "26-0147"
BID_PACKAGE_NUMBER = "26-0147-BP-26"


def categorize(check_name: str) -> str:
    """Group checks so the report can separate what is hard from what is easy.

    Scope assertions are the interesting number: mapping vendor prose onto a
    four-state vocabulary is the judgment the model is actually being asked
    for. Reading a dollar figure off a page is not the same task, and averaging
    them into one accuracy figure would flatter the hard one.
    """
    for prefix, label in (
        ("scope:", "scope_assertions"),
        ("citation_present:", "citations"),
        ("allowance:", "allowances"),
        ("alternate:", "alternates"),
        ("submitted_rank:", "package_ranking"),
        ("adjusted_rank:", "package_ranking"),
        ("anomaly_", "package_findings"),
    ):
        if check_name.startswith(prefix):
            return label
    return "extracted_fields"


@dataclass
class FixtureScore:
    fixture: str
    golden: str
    vendor: str
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def passed(self) -> int:
        return sum(c.passed for c in self.checks)

    @property
    def total(self) -> int:
        return len(self.checks)


@dataclass
class EvaluationRun:
    provider: str
    model: str
    fixtures: list[FixtureScore] = field(default_factory=list)
    package_checks: list[CheckResult] = field(default_factory=list)
    duration_seconds: float = 0.0
    error: str | None = None

    @property
    def all_checks(self) -> list[CheckResult]:
        return [c for f in self.fixtures for c in f.checks] + self.package_checks

    @property
    def passed(self) -> int:
        return sum(c.passed for c in self.all_checks)

    @property
    def total(self) -> int:
        return len(self.all_checks)

    @property
    def accuracy_pct(self) -> float:
        return round(self.passed / self.total * 100, 1) if self.total else 0.0

    def by_category(self) -> dict[str, tuple[int, int]]:
        buckets: dict[str, list[int]] = {}
        for check in self.all_checks:
            bucket = buckets.setdefault(categorize(check.name), [0, 0])
            bucket[0] += int(check.passed)
            bucket[1] += 1
        return {k: (v[0], v[1]) for k, v in sorted(buckets.items())}

    def failures(self) -> list[tuple[str, CheckResult]]:
        out = [(f.vendor, c) for f in self.fixtures for c in f.checks if not c.passed]
        out += [("package", c) for c in self.package_checks if not c.passed]
        return out


def build_provider(live: bool, model: str | None):
    """FakeProvider by default; AnthropicProvider only when explicitly asked for."""
    from src import config

    if not live:
        from src.ai.fake_provider import FakeProvider

        return FakeProvider(), "fake", "recorded"

    if not config.has_anthropic_key():
        raise SystemExit(
            "\n  A live evaluation needs an Anthropic API key.\n\n"
            "  1. Copy .env.example to .env\n"
            "  2. Put your key on the ANTHROPIC_API_KEY= line\n"
            "  3. Run this again\n\n"
            "  Without --live the harness runs fully offline against the recorded\n"
            "  responses, which needs no key and costs nothing.\n"
        )

    from src.ai.anthropic_provider import AnthropicProvider

    resolved = model or config.ANTHROPIC_MODEL
    return (
        AnthropicProvider(
            api_key=config.ANTHROPIC_API_KEY,
            model=resolved,
            schemas_dir=config.SCHEMAS_DIR,
            prompts_dir=config.PROMPTS_DIR,
        ),
        "anthropic",
        resolved,
    )


def run_evaluation(live: bool = False, model: str | None = None) -> EvaluationRun:
    """Extract every fixture through one provider and score it against golden.

    The whole package runs in a single pass rather than per-fixture, because a
    per-fixture pass followed by a package pass would extract every document
    twice -- doubling the cost of a live run to buy nothing.
    """
    from src.persistence.db import init_db
    from src.pipeline import run_package

    provider, provider_name, model_name = build_provider(live, model)
    emails = REPO_ROOT / "sample-data" / "emails"
    golden_dir = REPO_ROOT / "eval" / "golden"

    run = EvaluationRun(provider=provider_name, model=model_name)
    scratch = REPO_ROOT / "eval" / "_eval.db"
    engine = init_db(scratch)
    started = time.monotonic()

    try:
        package = run_package(
            email_fixture_paths=[emails / name for name, _ in FIXTURE_GOLDEN_MAP],
            repo_root=REPO_ROOT,
            schemas_dir=REPO_ROOT / "schemas",
            provider=provider,
            engine=engine,
            project_number=PROJECT_NUMBER,
            bid_package_number=BID_PACKAGE_NUMBER,
        )
    except Exception as exc:  # noqa: BLE001
        # A live model producing schema-invalid output is a legitimate and
        # important evaluation result, not a harness crash. Report it as one.
        run.error = f"{type(exc).__name__}: {exc}"
        run.duration_seconds = round(time.monotonic() - started, 1)
        return run
    finally:
        engine.dispose()
        scratch.unlink(missing_ok=True)

    run.duration_seconds = round(time.monotonic() - started, 1)

    for result, (fixture_name, golden_name) in zip(package.results, FIXTURE_GOLDEN_MAP):
        if golden_name is None:
            continue
        golden = load_golden(golden_dir / golden_name)
        run.fixtures.append(FixtureScore(
            fixture=fixture_name,
            golden=golden_name,
            vendor=result.vendor_name,
            checks=compare(result, golden),
        ))

    run.package_checks = compare_package(
        package.comparison, load_golden(golden_dir / PACKAGE_GOLDEN)
    )
    return run


def print_run(run: EvaluationRun, verbose: bool = False) -> bool:
    """Print one evaluation run. Returns True when everything passed."""
    print("\n" + "=" * 78)
    print(f"GOLDEN EVALUATION -- provider={run.provider} model={run.model}")
    print("=" * 78)

    if run.error:
        print(f"\n  RUN FAILED after {run.duration_seconds}s\n")
        print(f"  {run.error}\n")
        print("  For a live run this usually means the model returned output the bid")
        print("  schema rejected. That is a real finding about the model, not a bug in")
        print("  the harness.\n")
        return False

    for fixture in run.fixtures:
        mark = "ok  " if fixture.passed == fixture.total else "FAIL"
        print(f"  [{mark}] {fixture.vendor:<34} {fixture.passed:>3}/{fixture.total} checks")

    package_passed = sum(c.passed for c in run.package_checks)
    package_mark = "ok  " if package_passed == len(run.package_checks) else "FAIL"
    print(f"  [{package_mark}] {'Package comparison':<34} "
          f"{package_passed:>3}/{len(run.package_checks)} checks")

    print("\n  By category:")
    for category, (passed, total) in run.by_category().items():
        pct = round(passed / total * 100, 1) if total else 0.0
        print(f"    {category:<20} {passed:>3}/{total:<4} {pct:>5.1f}%")

    failures = run.failures()
    if failures:
        print(f"\n  {len(failures)} failing check(s):")
        shown = failures if verbose else failures[:15]
        for vendor, check in shown:
            print(f"    {vendor} :: {check.name}")
            print(f"      expected={check.expected!r}")
            print(f"      actual  ={check.actual!r}")
        if len(failures) > len(shown):
            print(f"    ... {len(failures) - len(shown)} more (use --verbose)")

    print("\n" + "-" * 78)
    print(f"  {run.passed}/{run.total} checks passed  ({run.accuracy_pct}%)  "
          f"in {run.duration_seconds}s")
    print("-" * 78 + "\n")
    return run.passed == run.total


def print_comparison(baseline: EvaluationRun, candidate: EvaluationRun) -> None:
    """Two runs side by side, so drift between them is the visible thing."""
    print("\n" + "=" * 78)
    print(f"COMPARISON -- {baseline.model} (baseline) vs {candidate.model}")
    print("=" * 78)

    print(f"\n  {'category':<20} {'baseline':>12} {'candidate':>12}   delta")
    base_cats, cand_cats = baseline.by_category(), candidate.by_category()
    for category in sorted(set(base_cats) | set(cand_cats)):
        b_pass, b_total = base_cats.get(category, (0, 0))
        c_pass, c_total = cand_cats.get(category, (0, 0))
        b_pct = round(b_pass / b_total * 100, 1) if b_total else 0.0
        c_pct = round(c_pass / c_total * 100, 1) if c_total else 0.0
        delta = round(c_pct - b_pct, 1)
        arrow = " " if delta == 0 else ("+" if delta > 0 else "")
        print(f"  {category:<20} {b_pct:>11.1f}% {c_pct:>11.1f}%   {arrow}{delta}")

    base_failed = {(v, c.name) for v, c in baseline.failures()}
    cand_failed = {(v, c.name) for v, c in candidate.failures()}

    regressions = sorted(cand_failed - base_failed)
    fixes = sorted(base_failed - cand_failed)

    if regressions:
        print(f"\n  {len(regressions)} check(s) the candidate gets wrong "
              f"and the baseline gets right:")
        for vendor, name in regressions:
            print(f"    {vendor} :: {name}")
    if fixes:
        print(f"\n  {len(fixes)} check(s) the candidate gets right "
              f"and the baseline gets wrong:")
        for vendor, name in fixes:
            print(f"    {vendor} :: {name}")
    if not regressions and not fixes:
        print("\n  No difference: both runs pass and fail exactly the same checks.")

    print("\n" + "-" * 78)
    print(f"  baseline  {baseline.accuracy_pct:>5}%   ({baseline.passed}/{baseline.total})")
    print(f"  candidate {candidate.accuracy_pct:>5}%   ({candidate.passed}/{candidate.total})")
    print("-" * 78 + "\n")


def as_json(run: EvaluationRun) -> dict:
    return {
        "provider": run.provider,
        "model": run.model,
        "duration_seconds": run.duration_seconds,
        "error": run.error,
        "passed": run.passed,
        "total": run.total,
        "accuracy_pct": run.accuracy_pct,
        "by_category": {k: {"passed": p, "total": t} for k, (p, t) in run.by_category().items()},
        "fixtures": [
            {"vendor": f.vendor, "golden": f.golden, "passed": f.passed, "total": f.total}
            for f in run.fixtures
        ],
        "failures": [
            {"vendor": v, "check": c.name, "expected": repr(c.expected), "actual": repr(c.actual)}
            for v, c in run.failures()
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="run_eval",
        description=(
            "Score pipeline output against the golden answer key. Runs offline "
            "against recorded model responses by default; --live calls the real "
            "Anthropic API and needs a key."
        ),
    )
    parser.add_argument("--live", action="store_true",
                        help="call the real Anthropic API instead of recorded responses")
    parser.add_argument("--model", default=None,
                        help="model id for a live run "
                             "(default: ANTHROPIC_MODEL, else claude-sonnet-5)")
    parser.add_argument("--compare", action="store_true",
                        help="run the recorded baseline too and diff the two runs")
    parser.add_argument("--verbose", action="store_true", help="list every failing check")
    parser.add_argument("--json", metavar="PATH", default=None,
                        help="also write the result as JSON (eval/reports/ is git-ignored)")
    args = parser.parse_args(argv)

    if args.compare and not args.live:
        parser.error("--compare needs --live: there is nothing to compare a recorded run against.")

    run = run_evaluation(live=args.live, model=args.model)
    ok = print_run(run, verbose=args.verbose)

    if args.compare:
        baseline = run_evaluation(live=False)
        print_comparison(baseline, run)

    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(as_json(run), indent=2), encoding="utf-8")
        print(f"  wrote {out}\n")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
