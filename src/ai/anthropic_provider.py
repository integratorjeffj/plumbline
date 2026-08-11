"""Real AI provider adapter -- Claude via the Anthropic API.

Structured output is forced via tool-use: the model must call a single
tool whose input_schema is schemas/bid.schema.json, so the response is
guaranteed to be shape-valid before it ever reaches src/pipeline.py.
"""

import json
from pathlib import Path

import anthropic

from src.ai.prompts_loader import load_prompt
from src.ai.provider import AIProvider, ExtractionResult
from src.extraction.pdf_text import PageText, full_text

TOOL_NAME = "record_bid_extraction"


def _load_schema(schemas_dir: Path) -> dict:
    return json.loads((schemas_dir / "bid.schema.json").read_text(encoding="utf-8"))


class AnthropicProvider(AIProvider):
    provider_name = "anthropic"

    def __init__(self, api_key: str, model: str, schemas_dir: Path, prompts_dir: Path):
        if not api_key:
            raise ValueError(
                "AnthropicProvider requires an API key. Set ANTHROPIC_API_KEY in a local .env file "
                "(see .env.example) or pass one explicitly."
            )
        self.model_name = model
        self._client = anthropic.Anthropic(api_key=api_key)
        self._schemas_dir = schemas_dir
        self._prompts_dir = prompts_dir

    def extract_bid(self, pages: list[PageText], prompt_version: str) -> ExtractionResult:
        schema = _load_schema(self._schemas_dir)
        system_prompt = load_prompt(self._prompts_dir, prompt_version, section="system")
        document_text = full_text(pages)

        response = self._client.messages.create(
            model=self.model_name,
            max_tokens=2048,
            system=system_prompt,
            tools=[{
                "name": TOOL_NAME,
                "description": "Record the structured extraction of a subcontractor bid proposal.",
                "input_schema": schema,
            }],
            tool_choice={"type": "tool", "name": TOOL_NAME},
            messages=[{
                "role": "user",
                "content": (
                    "Extract the base bid, allowances, alternates, and the following scope items "
                    "from the attached subcontractor proposal: electrical_permit_fees, "
                    "performance_payment_bond, arc_flash_study.\n\n"
                    f"<document pages>\n{document_text}\n</document pages>"
                ),
            }],
        )

        tool_use = next(block for block in response.content if block.type == "tool_use")
        structured = tool_use.input

        return ExtractionResult(
            base_bid=structured["base_bid"],
            allowances=structured.get("allowances", []),
            alternates=structured.get("alternates", []),
            scope_assertions=structured.get("scope_assertions", {}),
            citations=structured.get("citations", {}),
            confidence_tier=structured.get("confidence_tier", "REVIEW"),
            provider=self.provider_name,
            model=self.model_name,
            raw_output=structured,
        )
