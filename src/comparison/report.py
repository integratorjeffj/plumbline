"""Console rendering of a package comparison.

Text output for now -- the Next.js review dashboard is Milestone 3. Keeping the
formatter separate from the comparison engine means the same computed result
can later feed a web view or a PDF report without recomputing anything.
"""

from src.comparison.compare import PackageComparison
from src.normalization.taxonomy import SCOPE_BY_KEY, SCOPE_KEYS, label_for

STATUS_GLYPH = {
    "Included": "YES",
    "Excluded": "NO",
    "Unclear": "???",
    "NotFound": "--",
}

WIDTH = 100


def _rule(char: str = "=") -> str:
    return char * WIDTH


def format_comparison(comparison: PackageComparison) -> str:
    lines: list[str] = []
    vendors = comparison.by_submitted_rank()

    lines.append(_rule())
    lines.append(f"BID LEVELING COMPARISON -- {comparison.bid_package_number}")
    lines.append(f"Project {comparison.project_number}   Budget ${comparison.budget:,.2f}   "
                 f"{len(vendors)} active bidders")
    lines.append(_rule())

    # ---------------- Pricing ----------------
    lines.append("\n[SUBMITTED vs ADJUSTED PRICING]")
    lines.append(f"  Adjustment values entered by: {comparison.adjustments_entered_by} "
                 f"(estimator-entered, not AI-derived)")
    lines.append("")
    lines.append(f"  {'Vendor':<32}{'Submitted':>14}{'Rank':>6}{'Adjusted':>14}{'Rank':>6}{'Move':>7}")
    lines.append("  " + "-" * (WIDTH - 4))
    for vendor in vendors:
        move = vendor.rank_movement
        move_str = f"{move:+d}" if move else "-"
        submitted = f"${vendor.submitted_total:,.0f}"
        adjusted = f"${vendor.adjusted_total:,.0f}"
        lines.append(
            f"  {vendor.vendor_name:<32}{submitted:>14}{vendor.submitted_rank:>6}"
            f"{adjusted:>14}{vendor.adjusted_rank:>6}{move_str:>7}"
        )

    if comparison.leveling_changes_the_answer:
        lines.append("")
        lines.append(f"  *** Lowest submitted: {comparison.lowest_submitted.vendor_name} "
                     f"(${comparison.lowest_submitted.submitted_total:,.2f})")
        lines.append(f"  *** Best value once leveled: {comparison.lowest_adjusted.vendor_name} "
                     f"(${comparison.lowest_adjusted.adjusted_total:,.2f})")
        lines.append("  *** The cheapest submitted bid is NOT the best value.")

    # ---------------- Leveling detail ----------------
    lines.append("\n[LEVELING ADJUSTMENTS APPLIED]")
    for vendor in vendors:
        if not vendor.adjustments:
            lines.append(f"  {vendor.vendor_name}: none")
            continue
        lines.append(f"  {vendor.vendor_name}:")
        for adjustment in vendor.adjustments:
            lines.append(f"      +${adjustment.amount:>10,.2f}  {adjustment.label} "
                         f"({adjustment.status})")
        lines.append(f"      ={vendor.leveling_delta:>11,.2f}  total "
                     f"({vendor.leveling_delta_pct:+.1f}%)")

    if comparison.out_of_package_scope_keys:
        lines.append("")
        lines.append("  Not adjusted (carried by other bid packages, would double-count):")
        for key in comparison.out_of_package_scope_keys:
            lines.append(f"      {label_for(key)}")

    # ---------------- Scope matrix ----------------
    lines.append("\n[SCOPE MATRIX]")
    name_width = 40
    col_width = 13
    lines.append("  " + "Scope item".ljust(name_width)
                 + "".join(v.vendor_name.split()[0][:col_width - 1].rjust(col_width) for v in vendors))
    lines.append("  " + "-" * (name_width + col_width * len(vendors)))
    for scope_key in SCOPE_KEYS:
        row = comparison.scope_matrix[scope_key]
        marker = "" if SCOPE_BY_KEY[scope_key].in_package_scope else " *"
        # Truncate the label BEFORE appending the marker, so a long out-of-package
        # label cannot silently lose the asterisk that explains why it is not priced.
        label = label_for(scope_key)[:name_width - 1 - len(marker)] + marker
        cells = "".join(STATUS_GLYPH[row[v.vendor_id]].rjust(col_width) for v in vendors)
        lines.append("  " + label.ljust(name_width) + cells)
    lines.append("  " + "-" * (name_width + col_width * len(vendors)))
    lines.append("  YES=Included  NO=Excluded  ???=Unclear  --=NotFound   * carried by another package")

    # ---------------- Revisions ----------------
    if comparison.revision_diffs:
        lines.append("\n[REVISIONS]")
        for diff in comparison.revision_diffs:
            lines.append(f"  {diff.vendor_name}: {diff.previous_label} -> {diff.current_label}   "
                         f"${diff.previous_total:,.2f} -> ${diff.current_total:,.2f} "
                         f"({diff.total_delta:+,.2f})")
            for change in diff.changes:
                if change.field == "submitted_total":
                    continue
                if change.delta is not None:
                    lines.append(f"      {change.label}: {change.delta:+,.2f}")
                else:
                    lines.append(f"      {change.label}: {change.previous} -> {change.current}")

    # ---------------- Anomalies ----------------
    lines.append("\n[FINDINGS]")
    if not comparison.anomalies:
        lines.append("  None.")
    for anomaly in comparison.anomalies:
        lines.append(f"  [{anomaly.severity:<6}] {anomaly.code}")
        lines.append(f"           {anomaly.summary}")

    lines.append("\n" + _rule())
    lines.append("HUMAN REVIEW REQUIRED -- this analysis is decision support, not an award "
                 "recommendation.")
    lines.append(_rule())
    return "\n".join(lines)
