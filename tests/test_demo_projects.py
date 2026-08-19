"""Every published demo package carries a complete record set.

The console reads demo/projects/*.json directly. A package missing its
prequalification or award data does not fail loudly -- it renders an empty
state, which reads to a visitor as "this product cannot do that" rather than
"nobody authored the records". These tests make that gap a test failure
instead of a quiet hole in the demo.
"""

import json

import pytest

PROJECT_SLUGS = ["falcon-medical", "harborview-mechanical", "westbrook-electrical"]

REQUIRED_KEYS = ["prequalification", "coverage", "award", "policy"]


@pytest.fixture
def projects_dir(repo_root):
    return repo_root / "demo" / "projects"


@pytest.fixture
def project(request, projects_dir):
    return json.loads((projects_dir / f"{request.param}.json").read_text(encoding="utf-8"))


def _load(projects_dir, slug):
    return json.loads((projects_dir / f"{slug}.json").read_text(encoding="utf-8"))


def test_every_published_package_is_listed_here(projects_dir):
    """A new package must be added to this list, not silently skipped."""
    on_disk = {p.stem for p in projects_dir.glob("*.json")}
    assert on_disk == set(PROJECT_SLUGS)


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
@pytest.mark.parametrize("key", REQUIRED_KEYS)
def test_package_carries_every_derived_section(projects_dir, slug, key):
    assert _load(projects_dir, slug).get(key), f"{slug} is missing {key}"


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_every_active_bidder_has_a_prequalification_record(projects_dir, slug):
    data = _load(projects_dir, slug)
    bidders = {v["vendor_id"] for v in data["vendors"]}
    assert bidders <= set(data["prequalification"]), (
        f"{slug}: bidders without a prequalification record would render as "
        f"'no prequalification record on file' and be silently unawardable"
    )


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_every_bidder_runs_the_same_six_gates(projects_dir, slug):
    for vendor_id, prequal in _load(projects_dir, slug)["prequalification"].items():
        assert len(prequal["gates"]) == 6, f"{slug}/{vendor_id}"


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_award_scores_every_bidder_and_ranks_only_the_eligible(projects_dir, slug):
    data = _load(projects_dir, slug)
    award = data["award"]

    assert {s["vendor_id"] for s in award["scores"]} == {v["vendor_id"] for v in data["vendors"]}

    ranks = sorted(s["rank"] for s in award["scores"] if s["eligible"])
    assert ranks == list(range(1, len(ranks) + 1))
    assert all(s["rank"] is None for s in award["scores"] if not s["eligible"])


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_award_recommends_an_eligible_bidder(projects_dir, slug):
    award = _load(projects_dir, slug)["award"]
    recommended = next(
        s for s in award["scores"] if s["vendor_id"] == award["recommended_vendor_id"]
    )
    assert recommended["eligible"] is True
    assert recommended["rank"] == 1


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_gated_bidders_state_why(projects_dir, slug):
    for score in _load(projects_dir, slug)["award"]["scores"]:
        if not score["eligible"]:
            assert score["disqualifying_reason"], f"{slug}/{score['vendor_id']}"


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_coverage_responses_match_the_bidders_compared(projects_dir, slug):
    data = _load(projects_dir, slug)
    assert data["coverage"]["responded_count"] == len(data["vendors"])


@pytest.mark.parametrize("slug", PROJECT_SLUGS)
def test_coverage_counts_add_up(projects_dir, slug):
    coverage = _load(projects_dir, slug)["coverage"]
    assert (
        coverage["responded_count"] + coverage["declined_count"] + coverage["no_response_count"]
        == coverage["invited_count"]
    )


# --------------------------------------------------------------------------
# The three packages should not read as copies of each other
# --------------------------------------------------------------------------

def test_the_three_packages_tell_different_stories(projects_dir):
    """Demo variety, asserted rather than hoped for.

    Falcon gates two bidders and the model confirms the leveled leader.
    Harborview gates nobody and the model overrules the leveled leader.
    Westbrook has a thin market and gates the best-performing firm on bonding.
    If all three ever collapsed onto the same shape, the demo would stop
    showing what the model is for.
    """
    shapes = set()
    for slug in PROJECT_SLUGS:
        data = _load(projects_dir, slug)
        gated = sum(1 for s in data["award"]["scores"] if not s["eligible"])
        shapes.add((
            gated > 0,
            data["award"]["agrees_with_lowest_leveled"],
            data["coverage"]["health"],
        ))
    assert len(shapes) == 3, f"packages collapsed onto {len(shapes)} distinct shape(s)"


def test_harborview_award_overrules_the_lowest_leveled_bid(projects_dir):
    data = _load(projects_dir, "harborview-mechanical")
    assert data["award"]["agrees_with_lowest_leveled"] is False
    assert all(s["eligible"] for s in data["award"]["scores"]), "no bidder should be gated here"


def test_westbrook_gates_its_strongest_performer_on_bonding(projects_dir):
    """The uncomfortable case: best history, surety line too small for the job."""
    data = _load(projects_dir, "westbrook-electrical")
    anchor = data["prequalification"]["anchor-electrical"]

    assert anchor["eligible"] is False
    failing = [g["code"] for g in anchor["gates"] if g["status"] == "fail"]
    assert failing == ["bond_single_project_exceeded"]

    experience = {
        s["vendor_id"]: next(f["score"] for f in s["factors"] if f["factor"] == "experience")
        for s in data["award"]["scores"]
    }
    assert experience["anchor-electrical"] == max(experience.values())


def test_westbrook_coverage_is_thin(projects_dir):
    data = _load(projects_dir, "westbrook-electrical")
    assert data["coverage"]["health"] == "thin"
    assert "coverage_thin" in {f["code"] for f in data["findings"]}
