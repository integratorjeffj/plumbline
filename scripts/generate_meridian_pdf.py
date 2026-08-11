"""Generate the synthetic Meridian Electric & Controls scope letter PDF.

Vendor C of the flagship scenario (docs/demo-scenario.md). Meridian sends its
pricing in the EMAIL BODY and attaches only a short scope letter, which is why
this PDF carries no base bid figure -- the extraction pipeline has to read the
email body and the attachment together.

Planted defects:
  * References Contract Drawings "Revision 1" while the project is at Rev 3.
  * Leaves temporary power ambiguous (neither included nor excluded) so scope
    normalization must produce `Unclear`, not a guess in either direction.

Run: python scripts/generate_meridian_pdf.py
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
)

from pdf_kit import cell, footer_note, letterhead, make_styles  # noqa: F401

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "sample-data" / "bids" / "meridian_electric_scope_letter.pdf"

COMPANY = "MERIDIAN ELECTRIC & CONTROLS"
TAGLINE = "Electrical and Controls Contracting - Decatur, GA"

styles = make_styles("#2f6f7d")

INCLUDED_SCOPE = [
    "Mobilization, supervision, and project management for the Division 26 scope.",
    "Branch power rough-in throughout the expansion and renovation areas.",
    "Feeders and distribution equipment as shown on the electrical drawings.",
    "Lighting branch circuitry to all fixture locations.",
    "Lighting fixtures furnished under a $38,000.00 fixture allowance.",
    "Electrical permit fees for the Division 26 work.",
    "Fire alarm device connections shown on the electrical drawings.",
    "Testing of installed feeders and branch circuits per the Project Manual.",
    "Closeout documentation, as-built markups, and warranty letters.",
]

EXCLUDED_SCOPE = [
    "Performance and payment bond.",
    "Utility-company charges, fees, and service-connection costs.",
    "Structured cabling and Division 27 Communications systems.",
    "Security, access control, and Division 28 Electronic Safety and Security systems.",
]


def build():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title="Meridian Electric & Controls - Scope Letter - Falcon Medical Center Expansion",
        author=COMPANY,
    )

    story = []

    # ---------------- Page 1: Scope of Work ----------------
    story += letterhead(styles, COMPANY, TAGLINE)
    story.append(Spacer(1, 6))
    story.append(Paragraph("SCOPE LETTER", styles["SectionHeading"]))
    story.append(Paragraph(
        "August 7, 2026<br/><br/>"
        "Crestmark Construction Partners<br/>"
        "Attention: Daniel Cho, Senior Estimator<br/>"
        "Re: Falcon Medical Center Expansion, Project 26-0147<br/>"
        "Bid Package 26-0147-BP-26, Division 26 Electrical",
        styles["Body"],
    ))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "Meridian Electric &amp; Controls is pleased to provide our proposal for the Division 26 "
        "electrical scope of work. Our pricing is provided in the accompanying email transmittal. "
        "This letter describes the scope of work on which that pricing is based.",
        styles["Body"],
    ))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "This proposal is based on the electrical Contract Drawings, Revision 1, and the Project "
        "Manual as furnished to bidders.",
        styles["Body"],
    ))
    story.append(Spacer(1, 14))
    story.append(Paragraph("INCLUDED SCOPE", styles["SectionHeading"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=styles.accent) for item in INCLUDED_SCOPE],
        bulletType="1", start=1, leftIndent=18,
    ))
    story.append(Spacer(1, 24))
    story.append(footer_note(styles, "Meridian Electric & Controls", "Page 1 of 2"))
    story.append(PageBreak())

    # ---------------- Page 2: Exclusions and Clarifications ----------------
    story += letterhead(styles, COMPANY, TAGLINE)
    story.append(Spacer(1, 6))
    story.append(Paragraph("EXCLUSIONS", styles["SectionHeading"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=styles.accent) for item in EXCLUDED_SCOPE],
        bulletType="1", start=1, leftIndent=18,
    ))

    story.append(Spacer(1, 18))
    story.append(Paragraph("CLARIFICATIONS", styles["SectionHeading"]))
    story.append(Paragraph(
        "Temporary power requirements for the project will be coordinated with the general "
        "contractor at the preconstruction meeting.",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Anticipated duration is 17 weeks from mobilization, subject to the approved project "
        "schedule. This proposal is valid for 30 calendar days.",
        styles["Body"],
    ))

    story.append(Spacer(1, 30))
    story.append(Paragraph("Respectfully submitted,", styles["Body"]))
    story.append(Spacer(1, 26))
    story.append(Paragraph("Curtis Boyd", styles["Body"]))
    story.append(Paragraph("Chief Estimator, Meridian Electric &amp; Controls", styles["Small"]))
    story.append(Paragraph("curtis.boyd@meridian-electric-demo.example", styles["Small"]))
    story.append(Spacer(1, 24))
    story.append(footer_note(styles, "Meridian Electric & Controls", "Page 2 of 2"))

    doc.build(story)
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
