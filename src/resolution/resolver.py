"""Deterministic project/vendor/bid-package resolution.

Exact-identifier lookup against the sample-data project and vendor records.
Per docs/architecture-review.md Section 4 (AI Responsibility Matrix),
deterministic matching runs first and AI fallback is only for genuinely
ambiguous cases -- the flagship fixture set supplies unambiguous
identifiers, so no AI fallback is needed for this slice.
"""

import json
from dataclasses import dataclass
from pathlib import Path


class ResolutionError(ValueError):
    """Raised when a project, bid package, or vendor cannot be resolved."""


@dataclass(frozen=True)
class ResolvedBidPackage:
    project_number: str
    project_name: str
    customer: str
    drawing_revision: str
    bid_package_number: str
    csi_division: str
    bid_package_description: str


@dataclass(frozen=True)
class ResolvedVendor:
    vendor_id: str
    name: str
    trade: str
    contact_name: str
    contact_email: str


def resolve_bid_package(project_number: str, bid_package_number: str, sample_data_dir: Path) -> ResolvedBidPackage:
    project_path = sample_data_dir / "projects" / f"{project_number}.json"
    if not project_path.exists():
        raise ResolutionError(f"No project record found for project number '{project_number}' at {project_path}")

    project = json.loads(project_path.read_text(encoding="utf-8"))
    packages = {bp["bid_package_number"]: bp for bp in project.get("bid_packages", [])}
    if bid_package_number not in packages:
        raise ResolutionError(
            f"Bid package '{bid_package_number}' not found on project '{project_number}'. "
            f"Known bid packages: {sorted(packages)}"
        )
    bp = packages[bid_package_number]

    return ResolvedBidPackage(
        project_number=project["project_number"],
        project_name=project["project_name"],
        customer=project["customer_owner"],
        drawing_revision=project["current_drawing_revision"],
        bid_package_number=bp["bid_package_number"],
        csi_division=bp["csi_division"],
        bid_package_description=bp["description"],
    )


def resolve_vendor(vendor_name: str, sample_data_dir: Path) -> ResolvedVendor:
    vendors_dir = sample_data_dir / "vendors"
    for vendor_path in sorted(vendors_dir.glob("*.json")):
        vendor = json.loads(vendor_path.read_text(encoding="utf-8"))
        if vendor["name"].strip().lower() == vendor_name.strip().lower():
            contact = vendor["contacts"][0] if vendor.get("contacts") else {}
            return ResolvedVendor(
                vendor_id=vendor["vendor_id"],
                name=vendor["name"],
                trade=vendor["trade"],
                contact_name=contact.get("name", ""),
                contact_email=contact.get("email", ""),
            )
    raise ResolutionError(f"No vendor record found matching '{vendor_name}' in {vendors_dir}")
