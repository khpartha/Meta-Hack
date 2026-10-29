"""Run the real inspection pipeline on test images and save annotated results.

Usage (from backend/, venv active):
    python scripts/run_pipeline.py                     # every image in test_images/
    python scripts/run_pipeline.py ../test_images/03_cart_left_in_aisle.jpg

Writes to backend/data/pipeline_runs/:
    <name>_result.png      final boxes (solid = SAM, dashed = Muse's approximate box)
    <name>_candidates.png  the numbered SAM candidates Muse chose from
    <name>.json            the InspectionReport
"""

import asyncio
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config  # noqa: E402
from app.meta_client import MetaClient  # noqa: E402
from app.pipeline import inspect_image  # noqa: E402

OUT = config.DATA_DIR / "pipeline_runs"
TEST_IMAGES = config.BACKEND_DIR.parent / "test_images"
SEV_COLOR = {"high": (255, 59, 48), "medium": (255, 149, 0), "low": (255, 214, 10)}


def dashed_rect(d: ImageDraw.ImageDraw, box, color, width, dash=18):
    x1, y1, x2, y2 = box
    for x in range(x1, x2, dash * 2):
        d.line([(x, y1), (min(x + dash, x2), y1)], color, width)
        d.line([(x, y2), (min(x + dash, x2), y2)], color, width)
    for y in range(y1, y2, dash * 2):
        d.line([(x1, y), (x1, min(y + dash, y2))], color, width)
        d.line([(x2, y), (x2, min(y + dash, y2))], color, width)


def draw_report(img: Image.Image, report) -> Image.Image:
    out = img.copy()
    d = ImageDraw.Draw(out)
    w = max(3, img.width // 300)
    font = ImageFont.load_default(size=max(16, img.width // 55))
    for f in report.findings:
        if not f.bounding_box:
            continue
        color = SEV_COLOR[f.severity]
        if f.localization == "approximate":
            dashed_rect(d, f.bounding_box, color, w)
        else:
            d.rectangle(f.bounding_box, outline=color, width=w)
        label = f"{f.id}: {f.object} ({f.severity})"
        d.text((f.bounding_box[0] + 4, max(0, f.bounding_box[1] - font.size - 6)), label,
               fill=color, font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    return out


async def run_one(client: MetaClient, path: Path) -> None:
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    debug: dict = {}
    report = await inspect_image(img, client, debug=debug)
    stem = path.stem
    draw_report(img, report).save(OUT / f"{stem}_result.png")
    if "marked_image" in debug:
        debug["marked_image"].save(OUT / f"{stem}_candidates.png")
    (OUT / f"{stem}.json").write_text(report.model_dump_json(indent=2))

    t = report.timings_ms
    print(f"\n=== {path.name}  ({sum(t.values()) / 1000:.1f}s: "
          + ", ".join(f"{k} {v / 1000:.1f}s" for k, v in t.items()) + ")")
    print(f"  Muse raw findings: {len(debug.get('raw_findings', []))}, "
          f"SAM hits per prompt: {debug.get('sam', {})}, candidates: {len(debug.get('candidates', []))}")
    for i, raw in enumerate(debug.get("raw_findings", [])):
        dec = debug.get("decisions", {}).get(i)
        verdict = "no verify" if dec is None else (
            f"kept, picked {dec['candidate_ids']}" if dec["is_obstruction"] else f"DISMISSED: {dec['reason']}")
        print(f"  [{i}] {raw['object']} ({raw['severity']}) prompts={raw['sam_prompts']} -> {verdict}")
    for f in report.findings:
        print(f"  => {f.object}: {f.localization} box={f.bounding_box} conf={f.confidence}")
    print(f"  {report.summary}")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = MetaClient()
    paths = [Path(p) for p in sys.argv[1:]] or sorted(
        p for p in TEST_IMAGES.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    for p in paths:
        try:
            await run_one(client, p)
        except Exception as e:  # keep going so one bad image doesn't stop the batch
            print(f"\n=== {p.name}: FAILED: {e}")
    print(f"\nResults in {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
