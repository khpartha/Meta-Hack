"""Inspection pipeline: detect (Muse) -> segment (SAM) -> verify (Muse) -> merge.

Why two Muse calls: SAM 3.1 returns EVERY instance of a noun ("cardboard box" -> 36
boxes in a cluttered scene, mostly stored goods), and descriptive prompts with
locations usually return nothing. So SAM proposes candidates from short nouns, and
Muse picks which numbered candidates belong to each finding (set-of-marks).
See scripts/test_sam_prompts.py for the experiment behind this.
"""

import asyncio
import base64
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from . import config
from .meta_client import MetaClient, SamBox
from .rules import RULES, apply_rules
from .schemas import Finding, InspectionReport

log = logging.getLogger(__name__)

Box = tuple[int, int, int, int]

DETECT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["scene_description", "findings"],
    "properties": {
        "scene_description": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "object", "observation", "evidence", "severity",
                    "recommendation", "sam_prompts", "approx_box",
                ],
                "properties": {
                    "object": {"type": "string"},
                    "observation": {"type": "string"},
                    "evidence": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "recommendation": {"type": "string"},
                    "sam_prompts": {"type": "array", "items": {"type": "string"}},
                    "approx_box": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["x1", "y1", "x2", "y2"],
                        "properties": {k: {"type": "integer"} for k in ("x1", "y1", "x2", "y2")},
                    },
                },
            },
        },
    },
}

VERIFY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["decisions"],
    "properties": {
        "decisions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["finding_id", "is_obstruction", "candidate_ids", "reason"],
                "properties": {
                    "finding_id": {"type": "integer"},
                    "is_obstruction": {"type": "boolean"},
                    "candidate_ids": {"type": "array", "items": {"type": "integer"}},
                    "reason": {"type": "string"},
                },
            },
        }
    },
}

SYSTEM = (
    "You are a warehouse safety inspection assistant. You report POSSIBLE hazards for a human "
    "to review; you never certify compliance. Only report what is clearly visible."
)

RULE = RULES["walkway_obstruction"]


def detect_prompt(w: int, h: int) -> str:
    return f"""Find possible walkway obstructions in this image.

Rule: {RULE["description"]}

For each possible obstruction return:
- object: short name
- observation: what is wrong and why it may block passage
- evidence: what you can see that supports it, and where it is in the image
- severity: high = blocks the path or creates a likely trip/collision; medium = narrows it; low = minor
- recommendation: one concrete action
- sam_prompts: 1 or 2 short noun phrases (1-3 words, singular, no location words) that an
  open-vocabulary segmentation model would use to find this object type, e.g. "cardboard box",
  "pallet", "sack", "pallet jack", "cart", "mop bucket". Prefer common everyday words.
- approx_box: your best estimate of a tight box around the object, in pixels of this
  {w}x{h} image (x1,y1 top-left, x2,y2 bottom-right)

Group items that form one pile into one finding. Report at most {config.MAX_FINDINGS}.
If the walkways are clear, return an empty findings list."""


def verify_prompt(findings: list[dict], n_candidates: int) -> str:
    lines = "\n".join(
        f"- finding {i}: {f['object']} - {f['evidence']}" for i, f in enumerate(findings)
    )
    return f"""This is the same image with {n_candidates} numbered candidate boxes from a
segmentation model. Many candidates are irrelevant (e.g. goods stored on racks).

Possible walkway obstructions reported earlier:
{lines}

For EACH finding, return:
- candidate_ids: every numbered box that covers that object (for a pile, all boxes in the
  pile). Empty list if no box covers it.
- is_obstruction: false if, looking again, the object is not actually in a walkway or travel
  path, or is not clearly visible. Otherwise true.
- reason: one short sentence."""


@dataclass
class Candidate:
    id: int  # 1-based, as drawn on the image
    box: Box
    confidence: Optional[float]
    prompt: str


# ---------- small pure helpers (unit tested) ----------

def iou(a: Box, b: Box) -> float:
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    if not inter:
        return 0.0
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])  # noqa: E731
    return inter / (area(a) + area(b) - inter)


def union_box(boxes: list[Box]) -> Box:
    return (
        min(b[0] for b in boxes), min(b[1] for b in boxes),
        max(b[2] for b in boxes), max(b[3] for b in boxes),
    )


def clamp_box(box: Box, w: int, h: int) -> Optional[Box]:
    x1, y1, x2, y2 = box
    x1, x2 = sorted((max(0, min(w, x1)), max(0, min(w, x2))))
    y1, y2 = sorted((max(0, min(h, y1)), max(0, min(h, y2))))
    if x2 - x1 < 4 or y2 - y1 < 4:
        return None
    return (x1, y1, x2, y2)


def scale_box(box: Box, s: float) -> Box:
    return tuple(round(v / s) for v in box)  # type: ignore[return-value]


def unique_prompts(findings: list[dict], limit: int) -> list[str]:
    seen: list[str] = []
    for f in findings:
        for p in f.get("sam_prompts", [])[:2]:
            p = " ".join(p.lower().split())
            if p and p not in seen:
                seen.append(p)
    return seen[:limit]


def build_candidates(results: dict[str, list[SamBox]]) -> list[Candidate]:
    pool: list[tuple[str, SamBox]] = []
    for prompt, boxes in results.items():
        good = [b for b in boxes if b.confidence is None or b.confidence >= config.MIN_SAM_CONFIDENCE]
        good.sort(key=lambda b: -(b.confidence or 0))
        pool += [(prompt, b) for b in good[: config.MAX_CANDIDATES_PER_PROMPT]]
    pool.sort(key=lambda pb: -(pb[1].confidence or 0))
    kept: list[tuple[str, SamBox]] = []
    for prompt, b in pool:
        if all(iou(b.box, k.box) < 0.85 for _, k in kept):
            kept.append((prompt, b))
        if len(kept) >= config.MAX_CANDIDATES:
            break
    return [Candidate(i + 1, b.box, b.confidence, p) for i, (p, b) in enumerate(kept)]


def summarize(findings: list[Finding]) -> str:
    if not findings:
        return "No possible walkway obstructions found."
    counts = {s: sum(f.severity == s for f in findings) for s in ("high", "medium", "low")}
    parts = ", ".join(f"{n} {s}" for s, n in counts.items() if n)
    noun = "obstruction" if len(findings) == 1 else "obstructions"
    return f"{len(findings)} possible walkway {noun} found ({parts}). Review before clearing the area."


# ---------- image helpers ----------

def to_data_url(img: Image.Image, quality: int = 90) -> str:
    buf = BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


MARK_COLORS = [(255, 59, 48), (0, 122, 255), (52, 199, 89), (255, 149, 0), (175, 82, 222), (255, 45, 85)]


def draw_marks(img: Image.Image, cands: list[Candidate]) -> Image.Image:
    out = img.copy()
    d = ImageDraw.Draw(out)
    size = max(16, img.width // 60)
    font = ImageFont.load_default(size=size)
    for c in cands:
        color = MARK_COLORS[c.id % len(MARK_COLORS)]
        d.rectangle(c.box, outline=color, width=max(2, img.width // 500))
        label = str(c.id)
        tx, ty = c.box[0] + 2, c.box[1] + 2
        l, t, r, b = d.textbbox((tx, ty), label, font=font)
        d.rectangle((l - 3, t - 2, r + 3, b + 2), fill=color)
        d.text((tx, ty), label, fill=(255, 255, 255), font=font)
    return out


# ---------- pipeline ----------

class Timer:
    def __init__(self):
        self.ms: dict[str, int] = {}
        self._t = time.perf_counter()

    def lap(self, name: str):
        now = time.perf_counter()
        self.ms[name] = round((now - self._t) * 1000)
        self._t = now


async def inspect_image(img: Image.Image, client: MetaClient, debug: Optional[dict] = None) -> InspectionReport:
    """Run the full inspection. Pass a dict as `debug` to get intermediate results back."""
    timer = Timer()
    W, H = img.size
    s = min(1.0, config.MODEL_MAX_SIDE / max(W, H))
    model_img = img.resize((round(W * s), round(H * s)), Image.LANCZOS) if s < 1 else img
    mw, mh = model_img.size
    data_url = to_data_url(model_img)

    # 1. detect
    det = await client.muse_json(SYSTEM, detect_prompt(mw, mh), data_url, "detect", DETECT_SCHEMA)
    raw = det.get("findings", [])[: config.MAX_FINDINGS]
    timer.lap("detect")

    decisions: dict[int, dict] = {}
    cands: list[Candidate] = []
    if raw:
        # 2. segment: one SAM call per unique short prompt, in parallel
        prompts = unique_prompts(raw, config.MAX_SAM_CALLS)
        results = await asyncio.gather(*(client.segment(data_url, p) for p in prompts), return_exceptions=True)
        sam: dict[str, list[SamBox]] = {}
        for p, r in zip(prompts, results):
            if isinstance(r, Exception):
                log.warning("SAM prompt %r failed: %s", p, r)
                r = []
            sam[p] = r
        cands = build_candidates(sam)
        timer.lap("segment")

        # 3. verify: Muse picks candidates per finding (skipped if SAM found nothing)
        if cands:
            marked_img = draw_marks(model_img, cands)
            ver = await client.muse_json(
                SYSTEM, verify_prompt(raw, len(cands)), to_data_url(marked_img), "verify", VERIFY_SCHEMA
            )
            decisions = {d["finding_id"]: d for d in ver.get("decisions", [])}
            timer.lap("verify")
            if debug is not None:
                debug["marked_image"] = marked_img
        if debug is not None:
            debug["sam"] = {p: len(v) for p, v in sam.items()}

    if debug is not None:
        debug["raw_findings"] = raw
        debug["candidates"] = cands
        debug["decisions"] = decisions

    # 4. merge
    by_id = {c.id: c for c in cands}
    findings: list[Finding] = []
    for i, f in enumerate(raw):
        dec = decisions.get(i)
        if dec and not dec["is_obstruction"]:
            log.info("Verifier dismissed finding %d (%s): %s", i, f["object"], dec["reason"])
            continue
        picked = [by_id[c] for c in (dec or {}).get("candidate_ids", []) if c in by_id]
        box: Optional[Box] = None
        conf: Optional[float] = None
        loc = "none"
        if picked:
            box = union_box([c.box for c in picked])
            confs = [c.confidence for c in picked if c.confidence is not None]
            conf = round(max(confs), 3) if confs else None
            loc = "sam"
        else:
            ab = f.get("approx_box") or {}
            box = clamp_box((ab.get("x1", 0), ab.get("y1", 0), ab.get("x2", 0), ab.get("y2", 0)), mw, mh)
            loc = "approximate" if box else "none"
        if box:
            box = clamp_box(scale_box(box, s), W, H)
            if box is None:
                loc = "none"
        findings.append(
            apply_rules(
                Finding(
                    id=len(findings),
                    category="walkway_obstruction",
                    severity=f["severity"],
                    object=f["object"],
                    observation=f["observation"],
                    evidence=f["evidence"],
                    bounding_box=box,
                    localization=loc,
                    confidence=conf,
                    recommendation=f.get("recommendation", ""),
                )
            )
        )
    timer.lap("merge")

    return InspectionReport(
        inspection_id=uuid.uuid4().hex[:12],
        created_at=datetime.now(timezone.utc),
        image_width=W,
        image_height=H,
        status="possible_hazards_found" if findings else "no_hazards_found",
        scene_description=det.get("scene_description", ""),
        summary=summarize(findings),
        findings=findings,
        models={"reasoning": config.REASONING_MODEL, "segmentation": config.SAM_MODEL, "mode": "live"},
        timings_ms=timer.ms,
    )
