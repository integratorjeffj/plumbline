from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

# Submission order matters: revision supersession is resolved by sequence.
SUBMISSION_ORDER = [
    "apex_electrical_bid_received.json",
    "voltage_systems_bid_received.json",
    "meridian_electric_bid_received.json",
    "ironclad_power_bid_received.json",
    "ironclad_power_revision_received.json",
]


@pytest.fixture
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture
def sample_data_dir(repo_root) -> Path:
    return repo_root / "sample-data"


@pytest.fixture
def apex_pdf_path(repo_root) -> Path:
    return repo_root / "sample-data" / "bids" / "apex_electrical_proposal.pdf"


@pytest.fixture
def voltage_xlsx_path(repo_root) -> Path:
    return repo_root / "sample-data" / "bids" / "voltage_systems_pricing.xlsx"


@pytest.fixture
def meridian_pdf_path(repo_root) -> Path:
    return repo_root / "sample-data" / "bids" / "meridian_electric_scope_letter.pdf"


@pytest.fixture
def apex_email_fixture_path(repo_root) -> Path:
    return repo_root / "sample-data" / "emails" / "apex_electrical_bid_received.json"


@pytest.fixture
def meridian_email_fixture_path(repo_root) -> Path:
    return repo_root / "sample-data" / "emails" / "meridian_electric_bid_received.json"


@pytest.fixture
def package_email_fixture_paths(repo_root) -> list[Path]:
    emails = repo_root / "sample-data" / "emails"
    return [emails / name for name in SUBMISSION_ORDER]


@pytest.fixture
def schemas_dir(repo_root) -> Path:
    return repo_root / "schemas"


@pytest.fixture
def golden_dir(repo_root) -> Path:
    return repo_root / "eval" / "golden"


@pytest.fixture
def golden_apex_path(golden_dir) -> Path:
    return golden_dir / "apex.json"


@pytest.fixture
def golden_package_path(golden_dir) -> Path:
    return golden_dir / "package_26-0147-BP-26.json"


@pytest.fixture
def package_result(package_email_fixture_paths, repo_root, schemas_dir, tmp_path):
    """Run the full four-vendor package pipeline once, offline via FakeProvider."""
    from src.ai.fake_provider import FakeProvider
    from src.persistence.db import init_db
    from src.pipeline import run_package

    engine = init_db(tmp_path / "test_package.db")
    return run_package(
        email_fixture_paths=package_email_fixture_paths,
        repo_root=repo_root,
        schemas_dir=schemas_dir,
        provider=FakeProvider(),
        engine=engine,
        project_number="26-0147",
        bid_package_number="26-0147-BP-26",
    )


@pytest.fixture
def evaluation_date():
    """Pinned date for prequalification.

    Certificate expiry and review-cycle staleness are both measured against a
    stated date, never against "now", so these assertions mean the same thing
    on any day the suite runs.
    """
    from datetime import date

    return date(2026, 8, 14)


@pytest.fixture
def prequal_policy(sample_data_dir):
    from src.comparison.prequalification import load_policy

    return load_policy(sample_data_dir / "company" / "crestmark.json")


@pytest.fixture
def vendor_records(sample_data_dir):
    from src.comparison.prequalification import load_vendor_records

    return load_vendor_records(sample_data_dir / "vendors")


@pytest.fixture
def package_prequal(package_result, vendor_records, prequal_policy, evaluation_date):
    """Prequalification for every bidder in the package, against LEVELED totals."""
    from src.comparison.prequalification import evaluate_package

    amounts = {v.vendor_id: v.adjusted_total for v in package_result.comparison.vendors}
    return evaluate_package(vendor_records, prequal_policy, amounts, evaluation_date)


@pytest.fixture
def schedule_requirement(sample_data_dir):
    import json

    raw = json.loads((sample_data_dir / "projects" / "26-0147.json").read_text(encoding="utf-8"))
    package = next(
        p for p in raw["bid_packages"] if p["bid_package_number"] == "26-0147-BP-26"
    )
    return package["schedule_requirement"]


@pytest.fixture
def package_award(package_result, package_prequal, prequal_policy, schedule_requirement):
    """Award recommendation at the default 40/30/20/10 weighting."""
    from src.comparison.award import recommend_award

    return recommend_award(
        package_result.comparison, package_prequal, prequal_policy, schedule_requirement
    )


@pytest.fixture
def coverage_policy(sample_data_dir):
    import json

    raw = json.loads((sample_data_dir / "company" / "crestmark.json").read_text(encoding="utf-8"))
    return raw["bid_coverage_policy"]


@pytest.fixture
def package_coverage(package_result, sample_data_dir, coverage_policy):
    from src.comparison.coverage import build_coverage, load_addenda, load_itb

    return build_coverage(
        load_itb(sample_data_dir / "itb" / "26-0147-BP-26.json"),
        load_addenda(sample_data_dir / "addenda" / "26-0147-BP-26.json"),
        package_result.bids,
        coverage_policy,
    )
