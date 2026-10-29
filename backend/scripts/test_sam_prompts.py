"""Experiment: which SAM prompt style localizes Muse's findings best?

For each image, Muse lists possible obstructions with two prompt styles:
  long  - descriptive phrase with location ("the stack of boxes in the center foreground")
  short - 1-3 word noun phrase, no location ("cardboard box", "orange cart")
Each style is sent to SAM 3.1 and the boxes are drawn to backend/data/sam_experiments/.
Open the PNGs and compare: does SAM return only the flagged object, or every instance?

Usage (from backend/, venv active):
    python scripts/test_sam_prompts.py                      # all images in test_images/
    python scripts/test_sam_prompts.py ../test_images/03_cart_left_in_aisle.jpg
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from test_api import (  # noqa: E402
    BACKEND_DIR,
    BASE_URL,
    IMAGE_EXTS,
    REASONING_MODEL,
    TEST_IMAGES_DIR,
    ask_sam,
    to_data_url,
)

OUT_DIR = BACKEND_DIR / "data" / "sam_experiments"

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["possible_obstructions"],
    "properties": {
        "possible_obstructions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["object", "severity", "long_prompt", "short_prompt"],
                "properties": {
                    "object": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "long_prompt": {
                        "type": "string",
                        "description": "Descriptive phrase including where it is in the image",
                    },
                    "short_prompt": {
                        "type": "string",
                        "description": "1-3 word noun phrase naming the object type, no location words",
                    },
                },
            },
        }
    },
}

COLORS = [(255, 59, 48), (255, 204, 0), (52, 199, 89), (0, 122, 255), (175, 82, 222)]


def ask_muse(client: OpenAI, data_url: str) -> list[dict]:
    resp = client.chat.completions.create(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a warehouse safety inspection assistant. Identify POSSIBLE walkway "
                    "obstructions only: objects on the floor in a travel path. Ignore goods stored "
                    "on racks or shelves. Only report what is visibly present. If none, return an "
                    "empty list. For each, give a long_prompt (descriptive, with location) and a "
                    "short_prompt (1-3 word noun phrase like 'cardboard box' or 'pallet jack')."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "List possible walkway obstructions as JSON."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "obstructions", "schema": SCHEMA, "strict": True},
        },
    )
    return json.loads(resp.choices[0].message.content)["possible_obstructions"]


def draw(image_path: Path, results: list[tuple[str, list[dict]]], out: Path) -> None:
    img = Image.open(image_path).convert("RGB")
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=max(16, img.width // 60))
    for i, (label, boxes) in enumerate(results):
        color = COLORS[i % len(COLORS)]
        for b in boxes:
            d.rectangle(b["box"], outline=color, width=max(3, img.width // 400))
        d.text((10, 10 + i * (font.size + 6)), f"{label}: {len(boxes)} box(es)",
               fill=color, font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    img.save(out)


def run(client: OpenAI, image_path: Path) -> None:
    data_url = to_data_url(image_path)
    findings = ask_muse(client, data_url)
    print(f"\n=== {image_path.name}: {len(findings)} finding(s)")
    if not findings:
        return
    long_results, short_results = [], []
    for k, f in enumerate(findings):
        _, long_boxes = ask_sam(client, data_url, f["long_prompt"])
        _, short_boxes = ask_sam(client, data_url, f["short_prompt"])
        print(f"  [{k}] {f['object']} ({f['severity']})")
        print(f"      long  '{f['long_prompt']}' -> {len(long_boxes)} box(es)")
        print(f"      short '{f['short_prompt']}' -> {len(short_boxes)} box(es)")
        long_results.append((f"[{k}] long '{f['long_prompt'][:40]}'", long_boxes))
        short_results.append((f"[{k}] short '{f['short_prompt']}'", short_boxes))
    stem = image_path.stem
    draw(image_path, long_results, OUT_DIR / f"{stem}_long.png")
    draw(image_path, short_results, OUT_DIR / f"{stem}_short.png")


def main() -> None:
    load_dotenv(BACKEND_DIR / ".env")
    if not os.getenv("META_API_KEY"):
        sys.exit("META_API_KEY is not set in backend/.env")
    client = OpenAI(base_url=BASE_URL, api_key=os.environ["META_API_KEY"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 1:
        images = [Path(p) for p in sys.argv[1:]]
    else:
        images = sorted(p for p in TEST_IMAGES_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    for p in images:
        run(client, p)
    print(f"\nAnnotated images written to {OUT_DIR}")


if __name__ == "__main__":
    main()
