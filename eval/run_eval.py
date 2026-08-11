"""Compare pipeline output against a golden answer file.

This is the evaluation harness in miniature (docs/architecture-review.md
Section 10): because every fixture is authored by us, the correct answer
is known ahead of time, so extraction can be checked exactly rather than
eyeballed. `tests/test_pipeline_golden.py` runs this in CI against
FakeProvider output; a live run against AnthropicProvider is the separate,
explicitly-triggered evaluation track required by Amendment 4.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from src.pipeline import PipelineResult


@dataclass
class CheckResult:
    name: str
    passed: bool
    expected: object
    actual: object


def load_golden(golden_path: Path) -> dict:
    return json.loads(Path(golden_path).read_text(encoding="utf-8"))


def _find_allowance(allowances: list[dict], name: str) -> dict | None:
    for a in allowances:
        if a["name"] == name:
            return a
    return None


def _find_alternate(alternates: list[dict], alt_id: str) -> dict | None:
    for a in alternates:
        if a["id"] == alt_id:
            return a
    return None


def compare(result: PipelineResult, golden: dict) -> list[CheckResult]:
    checks: list[CheckResult] = []
    extraction = result.extraction

    checks.append(CheckResult("vendor_name", result.vendor_name == golden["vendor"], golden["vendor"], result.vendor_name))
    checks.append(CheckResult("project_number", result.project_number == golden["project_number"], golden["project_number"], result.project_number))
    checks.append(CheckResult("bid_package", result.bid_package_number == golden["bid_package"], golden["bid_package"], result.bid_package_number))
    checks.append(CheckResult("base_bid", extraction.base_bid == golden["base_bid"], golden["base_bid"], extraction.base_bid))

    for golden_allowance in golden["allowances"]:
        actual = _find_allowance(extraction.allowances, golden_allowance["name"])
        name = f"allowance:{golden_allowance['name']}"
        if actual is None:
            checks.append(CheckResult(name, False, golden_allowance, None))
            continue
        passed = (
            actual["amount"] == golden_allowance["amount"]
            and actual["included_in_base_bid"] == golden_allowance["included_in_base_bid"]
        )
        checks.append(CheckResult(name, passed, golden_allowance, actual))

    for golden_alt in golden["alternates"]:
        actual = _find_alternate(extraction.alternates, golden_alt["id"])
        name = f"alternate:{golden_alt['id']}"
        if actual is None:
            checks.append(CheckResult(name, False, golden_alt, None))
            continue
        passed = (
            actual["amount"] == golden_alt["amount"]
            and actual["included_in_base_bid"] == golden_alt["included_in_base_bid"]
        )
        checks.append(CheckResult(name, passed, golden_alt, actual))

    for scope_key, expected_status in golden["scope_assertions"].items():
        actual_status = extraction.scope_assertions.get(scope_key)
        checks.append(CheckResult(f"scope:{scope_key}", actual_status == expected_status, expected_status, actual_status))

    for field_name in golden["citations"]:
        present = field_name in extraction.citations
        checks.append(CheckResult(f"citation_present:{field_name}", present, "present", "present" if present else "missing"))

    return checks


def print_report(checks: list[CheckResult]) -> bool:
    print("\n" + "-" * 78)
    print("GOLDEN EVALUATION -- Apex Electrical Contractors")
    print("-" * 78)
    all_passed = True
    for c in checks:
        status = "PASS" if c.passed else "FAIL"
        if not c.passed:
            all_passed = False
        print(f"  [{status}] {c.name}" + ("" if c.passed else f"  expected={c.expected!r} actual={c.actual!r}"))
    print("-" * 78)
    print(f"  {sum(c.passed for c in checks)}/{len(checks)} checks passed")
    print("-" * 78)
    return all_passed
