"""Compare pipeline output against golden answer files.

This is the evaluation harness (docs/architecture-review.md Section 10): because
every fixture is authored by us, the correct answer is known ahead of time, so
extraction and comparison can be checked exactly rather than eyeballed.

`tests/` runs these comparisons in CI against FakeProvider output; a live run
against AnthropicProvider is the separate, explicitly-triggered evaluation track
required by Amendment 4.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from src.comparison.compare import PackageComparison
from src.pipeline import PipelineResult


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
