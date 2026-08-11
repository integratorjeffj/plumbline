"""REQ-001: deterministic, page-aware PDF text extraction."""

from src.extraction.pdf_text import extract_pages


def test_apex_pdf_has_five_pages(apex_pdf_path):
    pages = extract_pages(apex_pdf_path)
    assert len(pages) == 5
    assert [p.page_number for p in pages] == [1, 2, 3, 4, 5]


def test_apex_pdf_section_headings_land_on_expected_pages(apex_pdf_path):
    pages = {p.page_number: p.text for p in extract_pages(apex_pdf_path)}
    assert "PROPOSAL SUMMARY" in pages[1]
    assert "$191,850.00" in pages[1]
    assert "SCOPE OF WORK" in pages[2]
    assert "Electrical permit fees" in pages[2] or "permit fees" in pages[2].lower()
    assert "ALLOWANCES" in pages[3]
    assert "ALTERNATES" in pages[3]
    assert "$42,500.00" in pages[3]
    assert "$8,750.00" in pages[3]
    assert "CLARIFICATIONS AND EXCLUSIONS" in pages[4]
    assert "Performance an" in pages[4] or "bond" in pages[4].lower()


def test_apex_pdf_never_mentions_arc_flash(apex_pdf_path):
    pages = extract_pages(apex_pdf_path)
    full_text = "\n".join(p.text for p in pages).lower()
    assert "arc-flash" not in full_text and "arc flash" not in full_text
