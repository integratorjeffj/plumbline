"""REQ-003: deterministic project/vendor/bid-package resolution."""

import pytest

from src.resolution.resolver import ResolutionError, resolve_bid_package, resolve_vendor


def test_resolve_bid_package_success(sample_data_dir):
    bp = resolve_bid_package("26-0147", "26-0147-BP-26", sample_data_dir)
    assert bp.project_name == "Falcon Medical Center Expansion"
    assert bp.customer == "Falcon Regional Health System"
    assert bp.drawing_revision == "Rev 3"
    assert bp.csi_division == "26"


def test_resolve_bid_package_unknown_project_raises(sample_data_dir):
    with pytest.raises(ResolutionError):
        resolve_bid_package("99-9999", "99-9999-BP-26", sample_data_dir)


def test_resolve_bid_package_unknown_package_raises(sample_data_dir):
    with pytest.raises(ResolutionError):
        resolve_bid_package("26-0147", "26-0147-BP-99", sample_data_dir)


def test_resolve_vendor_success(sample_data_dir):
    vendor = resolve_vendor("Apex Electrical Contractors", sample_data_dir)
    assert vendor.vendor_id == "apex-electrical"
    assert vendor.contact_email == "jordan.wells@apex-electrical-demo.example"


def test_resolve_vendor_unknown_raises(sample_data_dir):
    with pytest.raises(ResolutionError):
        resolve_vendor("Nonexistent Electrical LLC", sample_data_dir)
