import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .images import load_upload
from .schemas import InspectionReport

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
    # TODO: real pipeline (Muse Spark -> SAM 3.1 -> verify -> report)
    raise HTTPException(501, "Real inspection not implemented yet; use ?mock=hazards or ?mock=clean")
