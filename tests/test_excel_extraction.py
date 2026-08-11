"""REQ-001: deterministic Excel extraction (Voltage Systems workbook)."""

from src.extraction.excel_tables import extract_sheets, sheet_names


def test_voltage_workbook_sheets(voltage_xlsx_path):
    assert sheet_names(voltage_xlsx_path) == ["Bid Summary", "Pricing Detail", "Exclusions", "Notes"]


def test_sheet_index_maps_to_page_number(voltage_xlsx_path):
    sheets = extract_sheets(voltage_xlsx_path)
    assert [s.page_number for s in sheets] == [1, 2, 3, 4]


def test_voltage_base_bid_appears_on_summary_sheet(voltage_xlsx_path):
    sheets = {s.page_number: s.text for s in extract_sheets(voltage_xlsx_path)}
    assert "$167,400.00" in sheets[1]
    assert "26-0147-BP-26" in sheets[1]


def test_voltage_exclusions_are_extractable(voltage_xlsx_path):
    sheets = {s.page_number: s.text for s in extract_sheets(voltage_xlsx_path)}
    exclusions = sheets[3].lower()
    assert "lighting fixtures" in exclusions
    assert "permit fees" in exclusions
    assert "bond" in exclusions


def test_voltage_workbook_never_mentions_arc_flash(voltage_xlsx_path):
    full_text = "\n".join(s.text for s in extract_sheets(voltage_xlsx_path)).lower()
    assert "arc-flash" not in full_text and "arc flash" not in full_text
