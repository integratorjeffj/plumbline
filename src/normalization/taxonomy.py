"""Canonical Division 26 scope taxonomy.

Vendors describe the same work in different words. The taxonomy is the fixed
vocabulary every proposal is normalized into so a comparison matrix has stable
rows. It is deliberately human-curated and small -- scoped to the terms that
actually appear in the four flagship fixtures -- rather than an open-ended
ontology the AI is free to invent categories in (docs/architecture-review.md
Section 4: AI maps to a fixed taxonomy, it does not define one).
"""

from dataclasses import dataclass

# Scope status values. `NotFound` and `Excluded` are never interchangeable:
# "the vendor said no" and "the proposal is silent" carry completely different
# procurement risk (charter Section 9).
INCLUDED = "Included"
EXCLUDED = "Excluded"
UNCLEAR = "Unclear"
NOT_FOUND = "NotFound"

SCOPE_STATUSES = (INCLUDED, EXCLUDED, UNCLEAR, NOT_FOUND)


@dataclass(frozen=True)
class ScopeItem:
    key: str
    label: str
    #  True when the item belongs to this bid package at all. Items carried by
    #  other packages (Div 27/28, utility charges) are tracked so the matrix can
    #  show them, but they must never be priced into an adjusted total here --
    #  that would double-count against another package's budget.
    in_package_scope: bool = True


SCOPE_ITEMS: tuple[ScopeItem, ...] = (
    ScopeItem("electrical_mobilization_supervision", "Electrical mobilization and supervision"),
    ScopeItem("branch_power_rough_in", "Branch power rough-in"),
    ScopeItem("lighting_branch_circuitry", "Lighting branch circuitry"),
    ScopeItem("lighting_fixtures", "Lighting fixtures"),
    ScopeItem("electrical_permit_fees", "Electrical permit fees"),
    ScopeItem("temporary_power", "Temporary power for own work"),
    ScopeItem("fire_alarm_device_connections", "Fire alarm device connections"),
    ScopeItem("feeder_branch_circuit_testing", "Testing of feeders and branch circuits"),
    ScopeItem("closeout_documentation", "Closeout documentation"),
    ScopeItem("performance_payment_bond", "Performance and payment bond"),
    ScopeItem("arc_flash_study", "Arc-flash study (Spec 26 05 73)"),
    ScopeItem("utility_company_charges", "Utility-company charges and fees", in_package_scope=False),
    ScopeItem("structured_cabling_div27", "Structured cabling (Div 27)", in_package_scope=False),
    ScopeItem("security_access_control_div28", "Security / access control (Div 28)", in_package_scope=False),
)

SCOPE_KEYS: tuple[str, ...] = tuple(item.key for item in SCOPE_ITEMS)
SCOPE_BY_KEY: dict[str, ScopeItem] = {item.key: item for item in SCOPE_ITEMS}

IN_PACKAGE_SCOPE_KEYS: tuple[str, ...] = tuple(
    item.key for item in SCOPE_ITEMS if item.in_package_scope
)


def label_for(key: str) -> str:
    return SCOPE_BY_KEY[key].label if key in SCOPE_BY_KEY else key


def is_known_scope_key(key: str) -> bool:
    return key in SCOPE_BY_KEY


def validate_status(status: str) -> str:
    if status not in SCOPE_STATUSES:
        raise ValueError(f"Unknown scope status {status!r}; expected one of {SCOPE_STATUSES}")
    return status
