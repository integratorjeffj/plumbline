"""Environment configuration for the vertical slice.

Loads .env (if present) so ANTHROPIC_API_KEY and DB_PATH can be set locally
without exporting shell variables. Never logs or prints the key itself.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
DB_PATH = Path(os.environ.get("DB_PATH", REPO_ROOT / "bid_intel.db"))
SAMPLE_DATA_DIR = REPO_ROOT / "sample-data"
SCHEMAS_DIR = REPO_ROOT / "schemas"
PROMPTS_DIR = REPO_ROOT / "src" / "ai" / "prompts"


def has_anthropic_key() -> bool:
    return bool(ANTHROPIC_API_KEY)
