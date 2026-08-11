"""Generate the synthetic Apex Electrical Contractors proposal PDF.

Builds the first golden fixture per docs/fixtures/apex-electrical-fixture-spec.md.
This is authored data (not AI-generated) so every fact and its page/section
location is exactly controlled -- the PDF IS the source of truth the pipeline
later extracts from and cites against.

Run: python scripts/generate_apex_pdf.py
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
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

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "sample-data" / "bids" / "apex_electrical_proposal.pdf"

NAVY = colors.HexColor("#1c2b3a")
COPPER = colors.HexColor("#b1591f")
RULE = colors.HexColor("#c7ced5")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="ApexWordmark", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle(name="ApexTagline", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#5b6672"), spaceAfter=14))
styles.add(ParagraphStyle(name="SectionHeading", fontName="Helvetica-Bold", fontSize=13, textColor=NAVY, spaceBefore=4, spaceAfter=10, borderColor=COPPER, borderWidth=0))
styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#14202b")))
styles.add(ParagraphStyle(name="BodyRight", parent=styles["Body"], alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="Small", fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#5b6672")))
styles.add(ParagraphStyle(name="CellBody", fontName="Helvetica", fontSize=9.5, leading=12, textColor=colors.HexColor("#14202b")))
styles.add(ParagraphStyle(name="CellHeader", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=NAVY))


def _cell(text: str, bold: bool = False):
    # Table cells must hold Paragraph flowables, not raw strings -- reportlab
    # does not wrap plain strings to a column width, and long text silently
    # overlaps the next column instead of raising an error.
    return Paragraph(text, styles["CellHeader"] if bold else styles["CellBody"])


def _header_block(page_label: str):
    return [
        Paragraph("APEX ELECTRICAL CONTRACTORS", styles["ApexWordmark"]),
        Paragraph("Commercial &amp; Healthcare Electrical Construction - Atlanta, GA", styles["ApexTagline"]),
    ]


def _footer_note(page_label: str):
    return Paragraph(
        f"Apex Electrical Contractors - Proposal for Falcon Medical Center Expansion, Project 26-0147, "
        f"Bid Package 26-0147-BP-26 - {page_label}",
        styles["Small"],
    )


def build():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Apex Electrical Contractors - Proposal - Falcon Medical Center Expansion",
        author="Apex Electrical Contractors",
    )

    story = []

    # ---------------- Page 1: Proposal Summary ----------------
    story += _header_block("Page 1")
    story.append(Spacer(1, 6))
    story.append(Paragraph("PROPOSAL SUMMARY", styles["SectionHeading"]))

    summary_rows = [
        ["Proposal Date:", "August 7, 2026"],
        ["Submitted To:", "Crestmark Construction Partners"],
        ["Attention:", "Daniel Cho, Senior Estimator"],
        ["Project:", "Falcon Medical Center Expansion"],
        ["Project Number:", "26-0147"],
        ["Bid Package:", "26-0147-BP-26 - Division 26 Electrical"],
        ["Base Bid:", "$191,850.00"],
        ["Bid Validity:", "30 calendar days from the Proposal Date"],
        ["Anticipated Duration:", "18 weeks from mobilization, subject to approved project schedule"],
    ]
    t = Table(summary_rows, colWidths=[1.9 * inch, 4.3 * inch])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#14202b")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, RULE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, RULE),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        "Apex Electrical Contractors is pleased to submit the enclosed proposal for the Division 26 "
        "electrical scope of work on the Falcon Medical Center Expansion, based on Contract Drawings "
        "Revision 3 and the Project Manual issued for bid. This proposal summary, together with the "
        "Scope of Work, Allowances and Alternates, and Clarifications and Exclusions sections that "
        "follow, constitutes our complete base bid submission.",
        styles["Body"],
    ))
    story.append(Spacer(1, 40))
    story.append(_footer_note("Page 1 of 5"))
    story.append(PageBreak())

    # ---------------- Page 2: Scope of Work ----------------
    story += _header_block("Page 2")
    story.append(Spacer(1, 6))
    story.append(Paragraph("SCOPE OF WORK", styles["SectionHeading"]))
    story.append(Paragraph(
        "The following electrical scope is included in our Base Bid of $191,850.00 for Bid Package "
        "26-0147-BP-26, unless separately identified as an Allowance, Alternate, or Exclusion elsewhere "
        "in this proposal:",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))

    included_items = [
        "Electrical mobilization and supervision for the duration of Apex's on-site work.",
        "Branch power rough-in for all areas shown on the electrical Contract Drawings.",
        "Lighting branch circuitry serving all fixture locations shown on the Contract Drawings.",
        "Lighting fixtures, furnished and installed within the $42,500.00 lighting fixture allowance "
        "described in the Allowances and Alternates section.",
        "Electrical permit fees associated with the Division 26 scope of work.",
        "Temporary power required for Apex's own electrical work during construction.",
        "Fire alarm device connections shown within the electrical Contract Drawings.",
        "Testing of installed feeders and branch circuits in accordance with the Project Manual.",
        "Standard closeout documentation for Apex's electrical scope, including as-built markups and "
        "warranty letters.",
        "Normal working-hours coordination with Crestmark's field superintendent and other trades.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=COPPER) for item in included_items],
        bulletType="1", start=1, leftIndent=18,
    ))
    story.append(Spacer(1, 40))
    story.append(_footer_note("Page 2 of 5"))
    story.append(PageBreak())

    # ---------------- Page 3: Allowances and Alternates ----------------
    story += _header_block("Page 3")
    story.append(Spacer(1, 6))
    story.append(Paragraph("ALLOWANCES", styles["SectionHeading"]))
    story.append(Paragraph(
        "The Base Bid includes the following allowance, which is carried in full within the "
        "$191,850.00 Base Bid stated on Page 1:",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))
    allowance_rows = [
        [_cell("Description", bold=True), _cell("Amount", bold=True), _cell("Status", bold=True)],
        [_cell("Lighting fixture allowance"), _cell("$42,500.00"), _cell("Included in Base Bid")],
    ]
    at = Table(allowance_rows, colWidths=[3.3 * inch, 1.5 * inch, 1.4 * inch])
    at.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef0f2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, NAVY),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(at)

    story.append(Spacer(1, 20))
    story.append(Paragraph("ALTERNATES", styles["SectionHeading"]))
    story.append(Paragraph(
        "The following alternate is priced separately and is NOT included in the Base Bid stated on "
        "Page 1. It will only apply to the contract if formally accepted in writing by Crestmark "
        "Construction Partners.",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))
    alt_rows = [
        [_cell("ID", bold=True), _cell("Description", bold=True), _cell("Amount", bold=True), _cell("Status", bold=True)],
        [_cell("A1"), _cell("Upgrade selected patient-room fixtures to owner-selected premium package"),
         _cell("Add $8,750.00"), _cell("Not included in Base Bid")],
    ]
    alt_t = Table(alt_rows, colWidths=[0.4 * inch, 2.9 * inch, 1.15 * inch, 1.65 * inch])
    alt_t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef0f2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, NAVY),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(alt_t)
    story.append(Spacer(1, 30))
    story.append(_footer_note("Page 3 of 5"))
    story.append(PageBreak())

    # ---------------- Page 4: Clarifications and Exclusions ----------------
    story += _header_block("Page 4")
    story.append(Spacer(1, 6))
    story.append(Paragraph("CLARIFICATIONS AND EXCLUSIONS", styles["SectionHeading"]))
    story.append(Paragraph(
        "This proposal is based on the Contract Drawings (Revision 3) and Project Manual issued for "
        "bid. The following items are explicitly excluded from our Base Bid and are not included in "
        "any Allowance or Alternate stated elsewhere in this proposal:",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))

    exclusion_items = [
        "Structured cabling and other Division 27 Communications systems.",
        "Security, access control, and other Division 28 Electronic Safety and Security systems.",
        "Utility-company charges, fees, and service-connection costs.",
        "Performance and payment bond. Bonding is excluded from the Base Bid and is available as an "
        "add-alternate if required by Crestmark; pricing will be furnished upon request.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), bulletColor=COPPER) for item in exclusion_items],
        bulletType="1", start=1, leftIndent=18,
    ))
    story.append(Spacer(1, 40))
    story.append(_footer_note("Page 4 of 5"))
    story.append(PageBreak())

    # ---------------- Page 5: Commercial / Schedule Terms ----------------
    story += _header_block("Page 5")
    story.append(Spacer(1, 6))
    story.append(Paragraph("COMMERCIAL AND SCHEDULE TERMS", styles["SectionHeading"]))
    story.append(Paragraph(
        "Anticipated duration is 18 weeks from mobilization, subject to an approved project schedule "
        "issued by Crestmark Construction Partners. Apex will coordinate normal working-hours access "
        "with the Crestmark field superintendent and will participate in scheduled preconstruction and "
        "trade-coordination meetings for the Division 26 scope of work. This proposal remains valid for "
        "30 calendar days from the Proposal Date stated on Page 1.",
        styles["Body"],
    ))
    story.append(Spacer(1, 30))
    story.append(Paragraph("Respectfully submitted,", styles["Body"]))
    story.append(Spacer(1, 26))
    story.append(Paragraph("Jordan Wells", styles["Body"]))
    story.append(Paragraph("Senior Estimator, Apex Electrical Contractors", styles["Small"]))
    story.append(Paragraph("jordan.wells@apex-electrical-demo.example", styles["Small"]))
    story.append(Spacer(1, 40))
    story.append(_footer_note("Page 5 of 5"))

    doc.build(story)
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
