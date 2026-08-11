"""Run the full four-vendor bid leveling comparison for the flagship package.

    python scripts/run_comparison.py --fake     # offline, deterministic
    python scripts/run_comparison.py            # live Claude extraction

Ingests all five submissions for bid package 26-0147-BP-26 (Apex, Voltage,
Meridian, Ironclad original, Ironclad Revision 1), extracts each, resolves the
revision supersession, levels the bids against estimator-entered adjustment
values, runs the deterministic anomaly rules, and prints the comparison.
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src import config  # noqa: E402
from src.ai.anthropic_provider import AnthropicProvider  # noqa: E402
from src.ai.fake_provider import FakeProvider  # noqa: E402
from src.comparison.report import format_comparison  # noqa: E402
from src.persistence.db import init_db  # noqa: E402
from src.pipeline import run_package  # noqa: E402
from eval.run_eval import compare_package, load_golden, print_report  # noqa: E402

PROJECT_NUMBER = "26-0147"
BID_PACKAGE_NUMBER = "26-0147-BP-26"

EMAILS_DIR = REPO_ROOT / "sample-data" / "emails"

# Submission order matters: revision supersession is resolved by sequence.
SUBMISSION_ORDER = [
    "apex_electrical_bid_received.json",
    "voltage_systems_bid_received.json",
    "meridian_electric_bid_received.json",
    "ironclad_power_bid_received.json",
    "ironclad_power_revision_received.json",
]

GOLDEN_PACKAGE_PATH = REPO_ROOT / "eval" / "golden" / "package_26-0147-BP-26.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fake", action="store_true", help="Use the offline FakeProvider")
    parser.add_argument("--skip-eval", action="store_true", help="Skip the golden comparison check")
    args = parser.parse_args()

    use_fake = args.fake or not config.has_anthropic_key()
    if use_fake and not args.fake:
        print("[info] ANTHROPIC_API_KEY not set -- falling back to FakeProvider. "
              "Set it in a local .env (see .env.example) to run live extraction.\n")

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
    package = run_package(
        email_fixture_paths=[EMAILS_DIR / name for name in SUBMISSION_ORDER],
        repo_root=REPO_ROOT,
        schemas_dir=config.SCHEMAS_DIR,
        provider=provider,
        engine=engine,
        project_number=PROJECT_NUMBER,
        bid_package_number=BID_PACKAGE_NUMBER,
    )

    print(format_comparison(package.comparison))

    if args.skip_eval:
        return 0

    golden = load_golden(GOLDEN_PACKAGE_PATH)
    checks = compare_package(package.comparison, golden)
    all_passed = print_report(checks, title="GOLDEN EVALUATION -- Package 26-0147-BP-26")
    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
