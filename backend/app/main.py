import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .images import load_upload
from .meta_client import MetaAPIError, MetaClient
from .pipeline import inspect_image
from .schemas import InspectionReport

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sceneguard")

FIXTURES = Path(__file__).parent / "fixtures"

app = FastAPI(title="SceneGuard AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sceneguard-backend"}


def _mock_report(kind: str, width: int, height: int) -> InspectionReport:
    """Load a fixture report and rescale its boxes to the uploaded image size."""
    name = "sample_report.json" if kind == "hazards" else "clean_report.json"
    report = InspectionReport.model_validate(json.loads((FIXTURES / name).read_text()))
    sx, sy = width / report.image_width, height / report.image_height
    for f in report.findings:
        if f.bounding_box:
            x1, y1, x2, y2 = f.bounding_box
            f.bounding_box = (round(x1 * sx), round(y1 * sy), round(x2 * sx), round(y2 * sy))
    report.inspection_id = f"mock-{uuid.uuid4().hex[:8]}"
    report.created_at = datetime.now(timezone.utc)
    report.image_width, report.image_height = width, height
    return report


@app.post("/api/inspect", response_model=InspectionReport)
async def inspect(
    image: UploadFile = File(...),
    mock: Optional[Literal["hazards", "clean"]] = Query(
        None, description="Return a canned report instead of calling the models"
    ),
):
    img = await load_upload(image)
    if mock:
        return _mock_report(mock, img.width, img.height)
    try:
        report = await inspect_image(img, _client())
    except MetaAPIError as e:
        log.error("Inspection failed: %s", e)
        raise HTTPException(502, f"Model API error: {e}")
    log.info("Inspection %s: %s timings=%s", report.inspection_id, report.summary, report.timings_ms)
    _save(report)
    return report


@app.get("/api/inspections/{inspection_id}", response_model=InspectionReport)
def get_inspection(inspection_id: str):
    if not re.fullmatch(r"[0-9a-f]{12}", inspection_id):
        raise HTTPException(404, "Not found")
    path = config.INSPECTIONS_DIR / f"{inspection_id}.json"
    if not path.exists():
        raise HTTPException(404, "Not found")
    return InspectionReport.model_validate_json(path.read_text())


_meta_client: Optional[MetaClient] = None


def _client() -> MetaClient:
    global _meta_client
    if _meta_client is None:
        try:
            _meta_client = MetaClient()
        except MetaAPIError as e:
            raise HTTPException(500, str(e))
    return _meta_client


def _save(report: InspectionReport) -> None:
    try:
        config.INSPECTIONS_DIR.mkdir(parents=True, exist_ok=True)
        (config.INSPECTIONS_DIR / f"{report.inspection_id}.json").write_text(report.model_dump_json(indent=2))
    except OSError as e:  # saving is best-effort; never fail the request over it
        log.warning("Could not save report: %s", e)
