"""The Milestone 1 vertical slice, in one command.

    python scripts/run_slice.py            # live Anthropic call (requires ANTHROPIC_API_KEY)
    python scripts/run_slice.py --fake      # offline run using the recorded FakeProvider

Ingests the synthetic Apex Electrical email event, hashes and extracts the
attached PDF, resolves it to the Crestmark/Falcon/Apex records, calls the
AI provider abstraction for structured extraction, validates the result,
persists it with full lineage, prints a Source Truth / AI Interpretation
summary, and checks the result against eval/golden/apex.json.
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src import config  # noqa: E402
from src.ai.anthropic_provider import AnthropicProvider  # noqa: E402
from src.ai.fake_provider import FakeProvider  # noqa: E402
from src.persistence.db import init_db  # noqa: E402
from src.pipeline import format_summary, run  # noqa: E402
from eval.run_eval import compare, load_golden, print_report  # noqa: E402

EMAIL_FIXTURE = REPO_ROOT / "sample-data" / "emails" / "apex_electrical_bid_received.json"
GOLDEN_PATH = REPO_ROOT / "eval" / "golden" / "apex.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fake", action="store_true", help="Use the offline FakeProvider instead of live Anthropic")
    args = parser.parse_args()

    use_fake = args.fake or not config.has_anthropic_key()
    if use_fake and not args.fake:
        print("[info] ANTHROPIC_API_KEY not set -- falling back to FakeProvider. "
              "Set it in a local .env (see .env.example) to run a live extraction.\n")

    if use_fake:
        provider = FakeProvider()
    else:
        provider = AnthropicProvider(
            api_key=config.ANTHROPIC_API_KEY,
            model=config.ANTHROPIC_MODEL,
            schemas_dir=config.SCHEMAS_DIR,
            prompts_dir=config.PROMPTS_DIR,
        )

    engine = init_db(config.DB_PATH)
    result = run(
        email_fixture_path=EMAIL_FIXTURE,
        repo_root=REPO_ROOT,
        schemas_dir=config.SCHEMAS_DIR,
        provider=provider,
        engine=engine,
    )

    print(format_summary(result))

    golden = load_golden(GOLDEN_PATH)
    checks = compare(result, golden)
    all_passed = print_report(checks)

    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
