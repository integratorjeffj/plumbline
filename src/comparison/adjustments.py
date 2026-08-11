"""Estimator-entered leveling adjustments.

The dollar value of a scope gap is a HUMAN input. The platform may detect that
a bidder excluded permit fees; deciding that the gap is worth $4,200 is the
estimator's judgment, and the charter is explicit that an AI-estimated
adjustment must never be presented as vendor-submitted pricing
(docs/charter.md Sections 10 and 30).

So adjustment values are loaded from a fixture that records who entered them,
and every applied adjustment carries that provenance through to the report.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from src.normalization.taxonomy import SCOPE_BY_KEY


@dataclass(frozen=True)
class AdjustmentRule:
    scope_key: str
    applies_when_status: tuple[str, ...]
    amount: float
    rationale: str


@dataclass(frozen=True)
class AdjustmentSet:
    project_number: str
    bid_package_number: str
    entered_by: str
    source: str
    rules: tuple[AdjustmentRule, ...]

    def rule_for(self, scope_key: str) -> AdjustmentRule | None:
        for rule in self.rules:
            if rule.scope_key == scope_key:
                return rule
        return None


def load_adjustments(path: Path) -> AdjustmentSet:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))

    if raw.get("source") != "estimator_entered":
        raise ValueError(
            f"Adjustment file {path} must declare source='estimator_entered'. "
            "Adjustment values are a human decision; an AI-derived value must not be loaded here."
        )

    rules = []
    for entry in raw["adjustments"]:
        scope_key = entry["scope_key"]
        if scope_key not in SCOPE_BY_KEY:
            raise ValueError(f"Adjustment references unknown scope key {scope_key!r} in {path}")
        if not SCOPE_BY_KEY[scope_key].in_package_scope:
            raise ValueError(
                f"Adjustment references {scope_key!r}, which is carried by another bid package. "
                "Pricing it here would double-count against that package's budget."
            )
        rules.append(AdjustmentRule(
            scope_key=scope_key,
            applies_when_status=tuple(entry["applies_when_status"]),
            amount=float(entry["amount"]),
            rationale=entry["rationale"],
        ))

    return AdjustmentSet(
        project_number=raw["project_number"],
        bid_package_number=raw["bid_package_number"],
        entered_by=raw.get("entered_by", "unknown"),
        source=raw["source"],
        rules=tuple(rules),
    )
