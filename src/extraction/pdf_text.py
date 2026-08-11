"""Deterministic, page-aware PDF text extraction.

Pure structural extraction (pdfplumber) -- no AI involved. This is the
"Source Truth" half of the pipeline: whatever text comes out of a given
page is exactly what a human opening the PDF to that page would read.
"""

from dataclasses import dataclass
from pathlib import Path

import pdfplumber


@dataclass(frozen=True)
class PageText:
    page_number: int  # 1-indexed, matches how a human refers to "page 3"
    text: str


def extract_pages(pdf_path: Path) -> list[PageText]:
    pdf_path = Path(pdf_path)
    pages: list[PageText] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append(PageText(page_number=i, text=text))
    return pages


def full_text(pages: list[PageText]) -> str:
    return "\n\n".join(f"[Page {p.page_number}]\n{p.text}" for p in pages)
