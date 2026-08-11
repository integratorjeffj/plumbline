"""Generate the synthetic Ironclad Power & Electric proposals (original + Revision 1).

Vendor D of the flagship scenario (docs/demo-scenario.md). Ironclad submits an
original proposal and then reissues a Revision 1 after Addendum 2 deletes the
standby generator feeder from the Division 26 package (-$4,550).

This pair is what exercises revision tracking: the system must recognize Rev 1
as superseding the original rather than treating it as a fifth competing bid,
summarize what changed, and compare using the latest revision while preserving
the original document.

Ironclad is also the only flagship bidder carrying performance and payment bond
inside its base bid -- the reason it wins on adjusted price despite not being
lowest on submitted price.

Run: python scripts/generate_ironclad_pdfs.py
"""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from pdf_kit import HEADER_BG, NAVY, RULE, cell, footer_note, letterhead, make_styles

REPO_ROOT = Path(__file__).resolve().parent.parent
BIDS_DIR = REPO_ROOT / "sample-data" / "bids"

COMPANY = "IRONCLAD POWER & ELECTRIC"
TAGLINE = "Electrical Contracting and Power Systems - Smyrna, GA"

styles = make_styles("#7a4b8f")

INCLUDED_SCOPE = [
    "Mobilization, supervision, and project management.",
    "Branch power rough-in for all expansion and renovation areas.",
    "Feeders and distribution equipment per the electrical drawings.",
    "Lighting branch circuitry serving all fixture locations.",
    "Lighting fixtures furnished under a $41,000.00 fixture allowance.",
    "Electrical permit fees for the Division 26 scope of work.",
    "Temporary power required for Ironclad's own work.",
    "Fire alarm device connections shown on the electrical drawings.",
    "Testing of installed feeders and branch circuits per the Project Manual.",
    "Closeout documentation, as-built markups, and warranty submittals.",
    "Performance and payment bond, included in the base bid.",
]

EXCLUDED_SCOPE = [
    "Utility-company charges, fees, and service-connection costs.",
    "Structured cabling and Division 27 Communications systems.",
    "Security, access control, and Division 28 Electronic Safety and Security systems.",
]

ORIGINAL_LINE_ITEMS = [
    ("Mobilization, supervision, and project management", 13200.00),
    ("Branch power rough-in", 55900.00),
    ("Feeders and distribution equipment", 44550.00),
    ("Lighting branch circuitry", 21750.00),
    ("Lighting fixture allowance", 41000.00),
    ("Fire alarm device connections", 3000.00),
    ("Temporary power for Ironclad work", 1800.00),
    ("Closeout documentation", 2000.00),
    ("Performance and payment bond", 1100.00),
]

# Addendum 2 deletes the standby generator feeder from this package.
REVISION_1_LINE_ITEMS = [
    (desc, 40000.00 if desc == "Feeders and distribution equipment" else amount)
    for desc, amount in ORIGINAL_LINE_ITEMS
]


def _pricing_table(line_items):
    rows = [[cell(styles, "Line Item", bold=True), cell(styles, "Amount", bold=True)]]
    for description, amount in line_items:
        rows.append([cell(styles, description), cell(styles, f"${amount:,.2f}")])
    rows.append([cell(styles, "TOTAL BASE BID", bold=True),
                 cell(styles, f"${sum(a for _, a in line_items):,.2f}", bold=True)])

    table = Table(rows, colWidths=[4.4 * inch, 1.7 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, NAVY),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, RULE),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build_proposal(output_path: Path, revision_label: str, line_items, basis_note: str,
                   revision_note: str | None = None):
    total = sum(a for _, a in line_items)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title=f"Ironclad Power & Electric - Proposal {revision_label} - Falcon Medical Center Expansion",
        author=COMPANY,
    )

    story = []

    # ---------------- Page 1: Proposal Summary ----------------
    story += letterhead(styles, COMPANY, TAGLINE)
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"PROPOSAL SUMMARY - {revision_label}", styles["SectionHeading"]))

    summary_rows = [
        ["Proposal Date:", "August 7, 2026" if revision_label == "Original" else "August 12, 2026"],
        ["Revision:", revision_label],
        ["Submitted To:", "Crestmark Construction Partners"],
        ["Attention:", "Daniel Cho, Senior Estimator"],
        ["Project:", "Falcon Medical Center Expansion"],
        ["Project Number:", "26-0147"],
        ["Bid Package:", "26-0147-BP-26 - Division 26 Electrical"],
        ["Drawing Revision:", "Rev 3"],
        ["Base Bid:", f"${total:,.2f}"],
        ["Bid Validity:", "30 calendar days"],
    ]
    table = Table([[cell(styles, k, bold=True), cell(styles, v)] for k, v in summary_rows],
                  colWidths=[1.9 * inch, 4.2 * inch])
    table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 14))
    story.append(Paragraph(basis_note, styles["Body"]))
    if revision_note:
        story.append(Spacer(1, 10))
        story.append(Paragraph(revision_note, styles["Body"]))
    story.append(Spacer(1, 24))
    story.append(footer_note(styles, "Ironclad Power & Electric", "Page 1 of 3"))
    story.append(PageBreak())

    # ---------------- Page 2: Pricing Detail ----------------
    story += letterhead(styles, COMPANY, TAGLINE)
    story.append(Spacer(1, 6))
    story.append(Paragraph("PRICING DETAIL", styles["SectionHeading"]))
    story.append(_pricing_table(line_items))
    story.append(Spacer(1, 24))
    story.append(footer_note(styles, "Ironclad Power & Electric", "Page 2 of 3"))
    story.append(PageBreak())

    # ---------------- Page 3: Scope and Exclusions ----------------
    story += letterhead(styles, COMPANY, TAGLINE)
    story.append(Spacer(1, 6))
    story.append(Paragraph("INCLUDED SCOPE", styles["SectionHeading"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=styles.accent) for item in INCLUDED_SCOPE],
        bulletType="1", start=1, leftIndent=18,
    ))
    story.append(Spacer(1, 16))
    story.append(Paragraph("EXCLUSIONS", styles["SectionHeading"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=styles.accent) for item in EXCLUDED_SCOPE],
        bulletType="1", start=1, leftIndent=18,
    ))
    story.append(Spacer(1, 22))
    story.append(Paragraph("Respectfully submitted,", styles["Body"]))
    story.append(Spacer(1, 22))
    story.append(Paragraph("Alicia Stern", styles["Body"]))
    story.append(Paragraph("Preconstruction Manager, Ironclad Power &amp; Electric", styles["Small"]))
    story.append(Paragraph("alicia.stern@ironclad-power-demo.example", styles["Small"]))
    story.append(Spacer(1, 20))
    story.append(footer_note(styles, "Ironclad Power & Electric", "Page 3 of 3"))

    doc.build(story)
    print(f"Wrote {output_path.name} -- base bid ${total:,.2f} ({output_path.stat().st_size:,} bytes)")


def build():
    BIDS_DIR.mkdir(parents=True, exist_ok=True)
    build_proposal(
        BIDS_DIR / "ironclad_power_proposal.pdf",
        "Original",
        ORIGINAL_LINE_ITEMS,
        "This proposal is based on the electrical Contract Drawings, Revision 3, and the Project "
        "Manual issued for bid.",
    )
    build_proposal(
        BIDS_DIR / "ironclad_power_proposal_rev1.pdf",
        "Revision 1",
        REVISION_1_LINE_ITEMS,
        "This proposal is based on the electrical Contract Drawings, Revision 3, the Project "
        "Manual issued for bid, and Addendum 2 dated August 11, 2026.",
        revision_note=(
            "Revision 1 supersedes our original proposal dated August 7, 2026. Per Addendum 2, the "
            "standby generator feeder previously shown in the Division 26 scope has been deleted "
            "from this package, reducing feeders and distribution equipment by $4,550.00. All other "
            "scope, allowances, and exclusions are unchanged."
        ),
    )


if __name__ == "__main__":
    build()
