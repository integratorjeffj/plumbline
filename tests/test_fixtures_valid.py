"""REQ-001 / REQ-002: fixture and schema validity."""

import json

import jsonschema


def test_bid_schema_is_valid_json_schema(schemas_dir):
    schema = json.loads((schemas_dir / "bid.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft7Validator.check_schema(schema)


def test_company_fixture_has_required_fields(sample_data_dir):
    company = json.loads((sample_data_dir / "company" / "crestmark.json").read_text(encoding="utf-8"))
    assert company["name"] == "Crestmark Construction Partners"
    assert company["email_domain"] == "crestmark-demo.example"
    assert any(r["name"] == "Daniel Cho" for r in company["roles"])


def test_project_fixture_has_flagship_bid_package(sample_data_dir):
    project = json.loads((sample_data_dir / "projects" / "26-0147.json").read_text(encoding="utf-8"))
    assert project["project_number"] == "26-0147"
    bp_numbers = [bp["bid_package_number"] for bp in project["bid_packages"]]
    assert "26-0147-BP-26" in bp_numbers


def test_vendor_fixture_matches_fixture_spec(sample_data_dir):
    vendor = json.loads((sample_data_dir / "vendors" / "apex-electrical.json").read_text(encoding="utf-8"))
    assert vendor["name"] == "Apex Electrical Contractors"
    assert vendor["contacts"][0]["email"] == "jordan.wells@apex-electrical-demo.example"


def test_email_event_fixture_references_apex_pdf(apex_email_fixture_path):
    event = json.loads(apex_email_fixture_path.read_text(encoding="utf-8"))
    assert event["mentioned_identifiers"]["project_number"] == "26-0147"
    assert event["mentioned_identifiers"]["bid_package_number"] == "26-0147-BP-26"
    assert event["attachments"][0]["filename"] == "apex_electrical_proposal.pdf"


def test_golden_apex_matches_fixture_spec_values(golden_apex_path):
    golden = json.loads(golden_apex_path.read_text(encoding="utf-8"))
    assert golden["base_bid"] == 191850.00
    assert golden["allowances"][0]["amount"] == 42500.00
    assert golden["allowances"][0]["included_in_base_bid"] is True
    assert golden["alternates"][0]["amount"] == 8750.00
    assert golden["alternates"][0]["included_in_base_bid"] is False
    assert golden["scope_assertions"]["electrical_permit_fees"] == "Included"
    assert golden["scope_assertions"]["performance_payment_bond"] == "Excluded"
    assert golden["scope_assertions"]["arc_flash_study"] == "NotFound"
