"""Settings loaded from backend/.env (or the real environment on Render)."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

META_API_KEY = os.getenv("META_API_KEY", "")
META_BASE_URL = os.getenv("META_BASE_URL", "https://api.meta.ai/v1")
REASONING_MODEL = os.getenv("REASONING_MODEL", "muse-spark-1.3")
SAM_MODEL = os.getenv("SAM_MODEL", "sam-3.1")

# Images are downscaled to this long side before being sent to the models.
MODEL_MAX_SIDE = int(os.getenv("MODEL_MAX_SIDE", "1600"))
REQUEST_TIMEOUT_S = float(os.getenv("REQUEST_TIMEOUT_S", "120"))

MAX_FINDINGS = 6            # Muse findings kept per image
MAX_SAM_CALLS = 5           # unique SAM prompts per image
MAX_CANDIDATES_PER_PROMPT = 25
MAX_CANDIDATES = 40         # numbered boxes shown to Muse in the verify step
MIN_SAM_CONFIDENCE = 0.4

DATA_DIR = BACKEND_DIR / "data"
INSPECTIONS_DIR = DATA_DIR / "inspections"
