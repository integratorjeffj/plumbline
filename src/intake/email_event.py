"""Load and validate a synthetic inbound-email event fixture.

Stands in for a real mailbox webhook (Microsoft Graph / Gmail) per the
simulation-to-production map in docs/architecture-review.md Section 11.
"""

import json
from dataclasses import dataclass
from pathlib import Path

REQUIRED_FIELDS = ["event_id", "event_type", "from", "subject", "attachments", "mentioned_identifiers"]


@dataclass(frozen=True)
class Attachment:
    filename: str
    path: Path
    content_type: str


@dataclass(frozen=True)
class EmailEvent:
    event_id: str
    subject: str
    sender_email: str
    attachments: list[Attachment]
    project_number: str
    bid_package_number: str
    vendor_name: str


def load_email_event(fixture_path: Path, repo_root: Path) -> EmailEvent:
    fixture_path = Path(fixture_path)
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))

    missing = [f for f in REQUIRED_FIELDS if f not in raw]
    if missing:
        raise ValueError(f"Email event fixture {fixture_path} is missing required fields: {missing}")

    if not raw["attachments"]:
        raise ValueError(f"Email event fixture {fixture_path} has no attachments")

    attachments = [
        Attachment(
            filename=a["filename"],
            path=repo_root / a["path"],
            content_type=a["content_type"],
        )
        for a in raw["attachments"]
    ]

    identifiers = raw["mentioned_identifiers"]
    return EmailEvent(
        event_id=raw["event_id"],
        subject=raw["subject"],
        sender_email=raw["from"]["email"],
        attachments=attachments,
        project_number=identifiers["project_number"],
        bid_package_number=identifiers["bid_package_number"],
        vendor_name=identifiers["vendor_name"],
    )
