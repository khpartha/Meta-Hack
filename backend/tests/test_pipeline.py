import asyncio

from PIL import Image

from app.meta_client import parse_sam_output
from app.pipeline import build_candidates, clamp_box, inspect_image, iou, union_box, unique_prompts
from app.meta_client import SamBox

from .fakes import FakeMeta, finding


def run(img, fake):
    return asyncio.run(inspect_image(img, fake))


def test_parse_sam_output_inclusive_to_half_open():
    raw = "0<|box;x1=10;y1=20;x2=29;y2=39;w=100;h=80;c=0.9|><|mask;xyz|>1<|box;x1=1;y1=2;x2=3;y2=4;w=100;h=80|>"
    out = parse_sam_output(raw)
    assert out[0].box == (10, 20, 30, 40) and out[0].confidence == 0.9
    assert out[1].confidence is None
    assert parse_sam_output("") == []


def test_box_helpers():
    assert iou((0, 0, 10, 10), (0, 0, 10, 10)) == 1
    assert iou((0, 0, 10, 10), (20, 20, 30, 30)) == 0
    assert union_box([(5, 5, 10, 10), (0, 8, 7, 20)]) == (0, 5, 10, 20)
    assert clamp_box((-5, 10, 200, 0), 100, 50) == (0, 0, 100, 10)
    assert clamp_box((10, 10, 12, 40), 100, 100) is None  # too thin


def test_unique_prompts_dedupes_and_caps():
    fs = [finding(prompts=["Cardboard Box", "box"]), finding(prompts=["cardboard  box", "pallet", "x"])]
    assert unique_prompts(fs, 10) == ["cardboard box", "box", "pallet"]
    assert unique_prompts(fs, 2) == ["cardboard box", "box"]


def test_build_candidates_filters_dedupes_and_numbers():
    c = build_candidates({
        "box": [SamBox((0, 0, 10, 10), 0.9), SamBox((0, 0, 10, 10), 0.8), SamBox((50, 50, 60, 60), 0.2)],
        "crate": [SamBox((0, 0, 10, 11), 0.95), SamBox((20, 20, 40, 40), None)],
    })
    assert [x.id for x in c] == [1, 2]
    assert c[0].prompt == "crate" and c[0].confidence == 0.95  # higher conf kept on overlap
    assert c[1].box == (20, 20, 40, 40)


def test_clean_image_makes_one_call():
    fake = FakeMeta(detect={"scene_description": "clear aisle", "findings": []})
    r = run(Image.new("RGB", (800, 600)), fake)
    assert r.status == "no_hazards_found" and r.findings == []
    assert fake.muse_calls == ["detect"] and fake.sam_calls == []


def test_full_flow_picks_candidates_and_scales_to_original():
    # 3200x2000 original -> model image 1600x1000 (scale 0.5)
    fake = FakeMeta(
        detect={"scene_description": "s", "findings": [
            finding("boxes", ["cardboard box"]),
            finding("cart", ["cart"], severity="high"),
            finding("stored goods", ["cardboard box"]),
        ]},
        sam={
            "cardboard box": [((100, 100, 200, 200), 0.8), ((180, 120, 300, 260), 0.7), ((900, 50, 950, 90), 0.6)],
            "cart": [((500, 400, 700, 800), 0.75)],
        },
        verify={"decisions": [
            {"finding_id": 0, "is_obstruction": True, "candidate_ids": [1, 3], "reason": "pile"},
            {"finding_id": 1, "is_obstruction": True, "candidate_ids": [2, 99], "reason": "cart"},
            {"finding_id": 2, "is_obstruction": False, "candidate_ids": [], "reason": "on rack"},
        ]},
    )
    r = run(Image.new("RGB", (3200, 2000)), fake)
    assert fake.muse_calls == ["detect", "verify"]
    assert sorted(fake.sam_calls) == ["cardboard box", "cart"]  # deduped
    assert len(r.findings) == 2  # stored goods dismissed by verifier
    boxes = r.findings[0]
    # candidates sorted by conf: 1=(100..200) 0.8, 2=cart 0.75, 3=(180..300) 0.7
    assert boxes.bounding_box == (200, 200, 600, 520) and boxes.localization == "sam"
    assert boxes.confidence == 0.8
    cart = r.findings[1]
    assert cart.bounding_box == (1000, 800, 1400, 1600) and cart.id == 1
    assert all(f.requires_human_review and f.recommendation for f in r.findings)
    assert r.status == "possible_hazards_found" and "2 possible walkway obstructions" in r.summary
    assert set(r.timings_ms) == {"detect", "segment", "verify", "merge"}


def test_no_sam_hits_falls_back_to_approx_box_without_verify():
    fake = FakeMeta(detect={"scene_description": "s", "findings": [finding("sacks", ["sack"], box=(10, 20, 110, 220))]})
    r = run(Image.new("RGB", (800, 600)), fake)
    assert fake.muse_calls == ["detect"]
    f = r.findings[0]
    assert f.localization == "approximate" and f.bounding_box == (10, 20, 110, 220) and f.confidence is None


def test_unpicked_finding_with_bad_approx_box_has_no_box():
    fake = FakeMeta(
        detect={"scene_description": "s", "findings": [finding(box=(0, 0, 0, 0))]},
        sam={"cardboard box": [((1, 1, 30, 30), 0.9)]},
        verify={"decisions": [{"finding_id": 0, "is_obstruction": True, "candidate_ids": [], "reason": "-"}]},
    )
    f = run(Image.new("RGB", (100, 100)), fake).findings[0]
    assert f.bounding_box is None and f.localization == "none"


def test_one_sam_failure_does_not_kill_inspection():
    fake = FakeMeta(
        detect={"scene_description": "s", "findings": [finding(prompts=["box", "crate"])]},
        sam={"crate": [((5, 5, 40, 40), 0.9)]},
        fail_sam={"box"},
        verify={"decisions": [{"finding_id": 0, "is_obstruction": True, "candidate_ids": [1], "reason": "-"}]},
    )
    f = run(Image.new("RGB", (100, 100)), fake).findings[0]
    assert f.bounding_box == (5, 5, 40, 40)
