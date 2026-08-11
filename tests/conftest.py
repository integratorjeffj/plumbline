from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent


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
def apex_email_fixture_path(repo_root) -> Path:
    return repo_root / "sample-data" / "emails" / "apex_electrical_bid_received.json"


@pytest.fixture
def schemas_dir(repo_root) -> Path:
    return repo_root / "schemas"


@pytest.fixture
def golden_apex_path(repo_root) -> Path:
    return repo_root / "eval" / "golden" / "apex.json"
