"""Standalone smoke test for Muse Spark + SAM 3.1 on the Meta Model API.

Usage (from backend/, venv active):
    python scripts/test_api.py                    # first image in test_images/
    python scripts/test_api.py path/to/image.jpg  # a specific image

Request formats follow https://dev.meta.ai/docs/sam/segmenting and
https://dev.meta.ai/docs/sam/reading-segmentation (checked 2026-10-29).
"""

import base64
import json
import mimetypes
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_IMAGES_DIR = BACKEND_DIR.parent / "test_images"
BASE_URL = "https://api.meta.ai/v1"
REASONING_MODEL = "muse-spark-1.3"
SAM_MODEL = "sam-3.1"
SAM_PROMPT = "cardboard boxes"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

OBSTRUCTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["scene_description", "possible_obstructions"],
    "properties": {
        "scene_description": {"type": "string"},
        "possible_obstructions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["object", "observation", "evidence", "severity", "segmentation_prompt"],
                "properties": {
                    "object": {"type": "string"},
                    "observation": {"type": "string"},
                    "evidence": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "segmentation_prompt": {"type": "string"},
                },
            },
        },
    },
}

# One SAM record: "<id><|box;...|><|mask;...|>". Box coords are source pixels;
# wire x2/y2 are inclusive. Optional ";c=<conf>" appears when include_confidence is on.
BOX_RE = re.compile(
    r"(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>"
)


def pick_image() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    images = sorted(p for p in TEST_IMAGES_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if not images:
        sys.exit(f"No images found in {TEST_IMAGES_DIR}")
    return images[0]


def to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def ask_muse_spark(client: OpenAI, data_url: str) -> dict:
    resp = client.chat.completions.create(
        model=REASONING_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a warehouse safety inspection assistant. Identify POSSIBLE "
                    "walkway obstructions only. Only report what is visibly present; every "
                    "finding needs human review. If none, return an empty list."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe possible walkway obstructions in this image as JSON."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "walkway_obstructions", "schema": OBSTRUCTION_SCHEMA, "strict": True},
        },
    )
    return json.loads(resp.choices[0].message.content)


def ask_sam(client: OpenAI, data_url: str, prompt: str) -> tuple[str, list[dict]]:
    resp = client.responses.create(
        model=SAM_MODEL,
        input=[
            {
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
        metadata={"mask_encoding": "one_bit", "include_confidence": "true"},
    )
    raw = resp.output_text
    boxes = []
    for m in BOX_RE.finditer(raw):
        obj_id, x1, y1, x2, y2, w, h, conf = m.groups()
        boxes.append(
            {
                "id": int(obj_id),
                # inclusive wire x2/y2 -> half-open, matching [x1, y1, x2, y2] convention
                "box": [int(x1), int(y1), int(x2) + 1, int(y2) + 1],
                "image_size": [int(w), int(h)],
                "confidence": float(conf) if conf else None,
            }
        )
    return raw, boxes


def main() -> None:
    load_dotenv(BACKEND_DIR / ".env")
    api_key = os.getenv("META_API_KEY")
    if not api_key:
        sys.exit("META_API_KEY is not set in backend/.env")

    client = OpenAI(base_url=BASE_URL, api_key=api_key)
    image = pick_image()
    data_url = to_data_url(image)
    print(f"Image: {image.name}\n")

    print(f"--- {REASONING_MODEL}: possible walkway obstructions ---")
    analysis = ask_muse_spark(client, data_url)
    print(json.dumps(analysis, indent=2))

    print(f"\n--- {SAM_MODEL}: '{SAM_PROMPT}' ---")
    raw, boxes = ask_sam(client, data_url, SAM_PROMPT)
    if not boxes:
        print("No boxes parsed. Raw output (first 500 chars):")
        print(raw[:500])
    for b in boxes:
        print(b)


if __name__ == "__main__":
    main()
