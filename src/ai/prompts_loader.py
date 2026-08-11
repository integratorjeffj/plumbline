"""Load a versioned prompt's system section from src/ai/prompts/*.md.

Keeps prompt text out of Python source (Amendment 1's provider abstraction
implies prompts are versioned artifacts, not inline strings) while staying
boring: no templating engine, just a `## System` section extracted from a
markdown file named after the prompt_version.
"""

from pathlib import Path


def load_prompt(prompts_dir: Path, prompt_version: str, section: str = "system") -> str:
    prompt_path = prompts_dir / f"{prompt_version}.md"
    if not prompt_path.exists():
        raise FileNotFoundError(f"No prompt file found for prompt_version={prompt_version!r} at {prompt_path}")

    text = prompt_path.read_text(encoding="utf-8")
    marker = f"## {section.capitalize()}"
    if marker not in text:
        raise ValueError(f"Prompt {prompt_path} has no '{marker}' section")

    after = text.split(marker, 1)[1]
    # Section ends at the next "## " heading or end of file.
    section_text = after.split("\n## ", 1)[0]
    return section_text.strip()
