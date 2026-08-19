"""Bid coverage and addenda acknowledgment.

Every other module in this package reasons about the bids that arrived. This one
reasons about the invitation list, which is a different and quieter question: a
package can look healthy because four proposals are sitting side by side, while
the reason the spread is narrow is that the three firms who would have priced it
lower never responded.

Coverage is therefore measured from the invitation out. A declined invitation is
information -- it usually means capacity, licensing, or a scope the market does
not want -- and a silent one is a follow-up nobody made.

Addendum acknowledgment is inferred from the drawing revision each proposal
states it priced against, rather than from a separate box on a form. That is
deliberate: the revision is evidence already extracted from the document and
already cited back to a page, whereas a signed acknowledgment page mostly proves
someone signed a page. If a bidder priced Revision 1 while the package is at
Revision 3, they did not incorporate Addenda 2 and 3, whatever they signed.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from src.comparison.anomalies import (
    SEVERITY_HIGH,
    SEVERITY_INFO,
    SEVERITY_MEDIUM,
    Anomaly,
)
from src.normalization.normalize import NormalizedBid

RESPONDED = "responded"
DECLINED = "declined"
NO_RESPONSE = "no_response"

COVERAGE_HEALTHY = "healthy"
COVERAGE_THIN = "thin"
COVERAGE_INSUFFICIENT = "insufficient"


@dataclass
class Invitation:
    vendor_id: str
    vendor_name: str
    invited_at: str
    status: str
    note: str | None = None


@dataclass
class AddendumAcknowledgment:
    vendor_id: str
    vendor_name: str
    drawing_revision_referenced: str | None
    acknowledged_through: int | None
    missing_addenda: list[int] = field(default_factory=list)

    @property
    def acknowledged(self) -> bool:
        return not self.missing_addenda and self.drawing_revision_referenced is not None

    @property
    def unstated(self) -> bool:
        """The proposal never said which revision it priced."""
        return self.drawing_revision_referenced is None


@dataclass
class PackageCoverage:
    bid_package_number: str
    issued_date: str
    bids_due: str
    invitations: list[Invitation]
    acknowledgments: list[AddendumAcknowledgment]
    current_addendum: int
    minimum_bidders: int
    target_bidders: int
    minimum_response_rate_pct: float

    @property
    def invited_count(self) -> int:
        return len(self.invitations)

    @property
    def responded(self) -> list[Invitation]:
        return [i for i in self.invitations if i.status == RESPONDED]

    @property
    def declined(self) -> list[Invitation]:
        return [i for i in self.invitations if i.status == DECLINED]

    @property
    def no_response(self) -> list[Invitation]:
        return [i for i in self.invitations if i.status == NO_RESPONSE]

    @property
    def response_rate_pct(self) -> float:
        if not self.invitations:
            return 0.0
        return round(len(self.responded) / len(self.invitations) * 100, 1)

    @property
    def health(self) -> str:
        """Three bands, because "enough bidders" and "enough interest" differ.

        Below the minimum the package is not competitively bid at all. At or
        above the minimum but under target, or with a weak response rate, it is
        thin: defensible, but worth another invitation before award.
        """
        if len(self.responded) < self.minimum_bidders:
            return COVERAGE_INSUFFICIENT
        if (
            len(self.responded) < self.target_bidders
            or self.response_rate_pct < self.minimum_response_rate_pct
        ):
            return COVERAGE_THIN
        return COVERAGE_HEALTHY

    @property
    def unacknowledged(self) -> list[AddendumAcknowledgment]:
        return [a for a in self.acknowledgments if a.missing_addenda]


def load_itb(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_addenda(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _normalize_revision(label: str) -> str:
    return label.lower().replace("revision", "rev").replace(" ", "")


def resolve_acknowledgment(
    bid: NormalizedBid, addenda: dict
) -> AddendumAcknowledgment:
    """Map a proposal's stated drawing revision onto the addenda it incorporates."""
    referenced = bid.drawing_revision_referenced
    by_revision = {
        _normalize_revision(a["drawing_revision"]): a["number"] for a in addenda["addenda"]
    }
    current = addenda["current_addendum"]
    all_numbers = [a["number"] for a in addenda["addenda"]]

    if referenced is None:
        # Unstated is not the same as stale. It is treated as acknowledging
        # nothing, because nothing was claimed.
        return AddendumAcknowledgment(
            vendor_id=bid.vendor_id,
            vendor_name=bid.vendor_name,
            drawing_revision_referenced=None,
            acknowledged_through=None,
            missing_addenda=list(all_numbers),
        )

    acknowledged_through = by_revision.get(_normalize_revision(referenced))
    if acknowledged_through is None:
        return AddendumAcknowledgment(
            vendor_id=bid.vendor_id,
            vendor_name=bid.vendor_name,
            drawing_revision_referenced=referenced,
            acknowledged_through=None,
            missing_addenda=list(all_numbers),
        )

    missing = [n for n in all_numbers if n > acknowledged_through and n <= current]
    return AddendumAcknowledgment(
        vendor_id=bid.vendor_id,
        vendor_name=bid.vendor_name,
        drawing_revision_referenced=referenced,
        acknowledged_through=acknowledged_through,
        missing_addenda=missing,
    )


def build_coverage(
    itb: dict,
    addenda: dict,
    bids: list[NormalizedBid],
    policy: dict,
) -> PackageCoverage:
    """Assemble coverage and acknowledgment for a package from ACTIVE bids."""
    active = [bid for bid in bids if bid.is_active]

    return PackageCoverage(
        bid_package_number=itb["bid_package_number"],
        issued_date=itb["issued_date"],
        bids_due=itb["bids_due"],
        invitations=[Invitation(**i) for i in itb["invitations"]],
        acknowledgments=[resolve_acknowledgment(bid, addenda) for bid in active],
        current_addendum=addenda["current_addendum"],
        minimum_bidders=policy["minimum_bidders_per_package"],
        target_bidders=policy["target_bidders_per_package"],
        minimum_response_rate_pct=policy["minimum_response_rate_pct"],
    )


def check_addenda_acknowledgment(coverage: PackageCoverage) -> list[Anomaly]:
    """Bidders who have not incorporated every issued addendum."""
    anomalies = []
    for ack in coverage.acknowledgments:
        if not ack.missing_addenda:
            continue

        if ack.unstated:
            anomalies.append(Anomaly(
                code="addenda_acknowledgment_unstated",
                severity=SEVERITY_MEDIUM,
                vendor_id=ack.vendor_id,
                vendor_name=ack.vendor_name,
                summary=(
                    f"{ack.vendor_name} does not state a drawing revision, so there is no "
                    f"evidence it incorporated any of the {len(ack.missing_addenda)} issued "
                    f"addenda."
                ),
                detail={"missing_addenda": ack.missing_addenda,
                        "current_addendum": coverage.current_addendum},
            ))
            continue

        numbers = ", ".join(str(n) for n in ack.missing_addenda)
        anomalies.append(Anomaly(
            code="addenda_not_acknowledged",
            severity=SEVERITY_HIGH,
            vendor_id=ack.vendor_id,
            vendor_name=ack.vendor_name,
            summary=(
                f"{ack.vendor_name} priced against {ack.drawing_revision_referenced} and has not "
                f"incorporated Addend{'a' if len(ack.missing_addenda) > 1 else 'um'} {numbers}."
            ),
            detail={
                "drawing_revision_referenced": ack.drawing_revision_referenced,
                "acknowledged_through": ack.acknowledged_through,
                "missing_addenda": ack.missing_addenda,
                "current_addendum": coverage.current_addendum,
            },
        ))
    return anomalies


def check_coverage(coverage: PackageCoverage) -> list[Anomaly]:
    """Whether the package drew enough of a market to call the result competitive."""
    anomalies = []
    responded = len(coverage.responded)

    if coverage.health == COVERAGE_INSUFFICIENT:
        anomalies.append(Anomaly(
            code="coverage_below_minimum",
            severity=SEVERITY_HIGH,
            summary=(
                f"Only {responded} of {coverage.invited_count} invited bidders responded, below "
                f"the {coverage.minimum_bidders}-bidder minimum for a competitively bid package."
            ),
            detail={"responded": responded, "invited": coverage.invited_count,
                    "minimum": coverage.minimum_bidders},
        ))
    elif coverage.health == COVERAGE_THIN:
        anomalies.append(Anomaly(
            code="coverage_thin",
            severity=SEVERITY_MEDIUM,
            summary=(
                f"{responded} of {coverage.invited_count} invited bidders responded "
                f"({coverage.response_rate_pct:.0f}%), meeting the {coverage.minimum_bidders}-bidder "
                f"minimum but short of the {coverage.target_bidders}-bidder target."
            ),
            detail={"responded": responded, "invited": coverage.invited_count,
                    "response_rate_pct": coverage.response_rate_pct,
                    "target": coverage.target_bidders},
        ))

    if coverage.no_response:
        names = ", ".join(i.vendor_name for i in coverage.no_response)
        anomalies.append(Anomaly(
            code="invitation_no_response",
            severity=SEVERITY_INFO,
            summary=(
                f"{len(coverage.no_response)} invited bidder(s) never responded: {names}."
            ),
            detail={"vendors": [{"vendor_id": i.vendor_id, "vendor_name": i.vendor_name,
                                 "note": i.note} for i in coverage.no_response]},
        ))

    return anomalies


def run_all(coverage: PackageCoverage) -> list[Anomaly]:
    return check_coverage(coverage) + check_addenda_acknowledgment(coverage)
