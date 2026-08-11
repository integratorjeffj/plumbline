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
