"""Shared primitives for generating synthetic vendor proposal PDFs.

Each fictional subcontractor gets its own accent color and wordmark so the
fixtures look like documents from four different companies, but the layout
mechanics (fonts, table cells, footers) live here once.

Two things this module exists to get right, both learned from real extraction
failures in the Apex fixture:

1. Table cells must be Paragraph flowables, never raw strings -- reportlab does
   not wrap plain strings to a column width, so long text silently overlaps the
   next column and comes out of pdfplumber interleaved and unreadable.
2. Use plain ASCII hyphens, not en/em dashes -- the default Helvetica encoding
   turns them into replacement characters in extracted text.
"""

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph

NAVY = colors.HexColor("#1c2b3a")
RULE = colors.HexColor("#c7ced5")
HEADER_BG = colors.HexColor("#eef0f2")


def make_styles(accent_hex: str):
    """Build a stylesheet for one vendor, keyed to that vendor's accent color."""
    accent = colors.HexColor(accent_hex)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Wordmark", fontName="Helvetica-Bold", fontSize=18,
                              textColor=NAVY, spaceAfter=2))
    styles.add(ParagraphStyle(name="Tagline", fontName="Helvetica", fontSize=9,
                              textColor=colors.HexColor("#5b6672"), spaceAfter=14))
    styles.add(ParagraphStyle(name="SectionHeading", fontName="Helvetica-Bold", fontSize=13,
                              textColor=NAVY, spaceBefore=4, spaceAfter=10))
    styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=10, leading=14,
                              textColor=colors.HexColor("#14202b")))
    styles.add(ParagraphStyle(name="Small", fontName="Helvetica", fontSize=8.5, leading=11,
                              textColor=colors.HexColor("#5b6672")))
    styles.add(ParagraphStyle(name="CellBody", fontName="Helvetica", fontSize=9.5, leading=12,
                              textColor=colors.HexColor("#14202b")))
    styles.add(ParagraphStyle(name="CellHeader", fontName="Helvetica-Bold", fontSize=9.5,
                              leading=12, textColor=NAVY))
    styles.accent = accent
    return styles


def cell(styles, text: str, bold: bool = False) -> Paragraph:
    """Wrap table cell text so reportlab actually wraps it to the column width."""
    return Paragraph(text, styles["CellHeader"] if bold else styles["CellBody"])


def letterhead(styles, company: str, tagline: str) -> list:
    return [
        Paragraph(company, styles["Wordmark"]),
        Paragraph(tagline, styles["Tagline"]),
    ]


def footer_note(styles, company: str, page_label: str) -> Paragraph:
    return Paragraph(
        f"{company} - Proposal for Falcon Medical Center Expansion, Project 26-0147, "
        f"Bid Package 26-0147-BP-26 - {page_label}",
        styles["Small"],
    )
