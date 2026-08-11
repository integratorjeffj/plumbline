"""REQ-002: source-document provenance via SHA-256."""

import hashlib

from src.extraction.hashing import sha256_bytes, sha256_file


def test_sha256_bytes_matches_stdlib():
    data = b"hello bid intelligence"
    assert sha256_bytes(data) == hashlib.sha256(data).hexdigest()


def test_sha256_file_matches_stdlib(apex_pdf_path):
    expected = hashlib.sha256(apex_pdf_path.read_bytes()).hexdigest()
    assert sha256_file(apex_pdf_path) == expected


def test_sha256_file_changes_if_bytes_change(tmp_path):
    f = tmp_path / "doc.txt"
    f.write_text("version 1")
    first = sha256_file(f)
    f.write_text("version 2")
    second = sha256_file(f)
    assert first != second
