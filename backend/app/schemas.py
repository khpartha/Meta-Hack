"""Pydantic models for findings and inspection reports.

This file is the contract between backend and frontend. If you change a field,
tell your teammate and update the "API contract" section in CLAUDE.md.

Boxes are [x1, y1, x2, y2] in ORIGINAL image pixels (x2/y2 exclusive).
The frontend scales them to the displayed size using image_width/image_height.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high"]
Category = Literal["walkway_obstruction"]  # MVP; add "ppe", "floor_clutter" later

BoundingBox = tuple[int, int, int, int]

DISCLAIMER = (
    "AI-assisted inspection, not a certified compliance check. "
    "Every finding is a possible hazard and needs human review."
)


class Finding(BaseModel):
    id: int = Field(description="Index within this report, 0-based")
    category: Category
    severity: Severity
    object: str = Field(description="Short name, e.g. 'stacked cardboard boxes'")
    observation: str = Field(description="What looks wrong and why")
    evidence: str = Field(description="What in the image supports this finding")
    bounding_box: Optional[BoundingBox] = Field(
        default=None,
        description="[x1, y1, x2, y2] original pixels; null if SAM could not localize it",
    )
    localization: Literal["sam", "approximate", "none"] = Field(
        default="none",
        description="sam = box from SAM 3.1; approximate = Muse's rough estimate "
        "(draw dashed); none = no box",
    )
    confidence: Optional[float] = Field(default=None, ge=0, le=1, description="SAM confidence")
    requires_human_review: bool = True
    recommendation: str


class InspectionReport(BaseModel):
    inspection_id: str
    created_at: datetime
    image_width: int
    image_height: int
    status: Literal["possible_hazards_found", "no_hazards_found"]
    scene_description: str
    summary: str
    findings: list[Finding]
    disclaimer: str = DISCLAIMER
    models: dict[str, str] = Field(description="Model names used, e.g. {'reasoning': 'muse-spark-1.3'}")
    timings_ms: dict[str, int] = Field(default_factory=dict, description="Per-step latency")
