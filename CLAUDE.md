# SceneGuard AI

AI-assisted visual safety inspection for warehouses. User uploads a workplace image, the agent finds possible hazards, localizes them, and returns an annotated inspection report. Hackathon deadline: Nov 4, 2026.

This is an AI-assisted inspection tool, NOT a certified compliance system. Every finding is a "possible" hazard that needs human review. Never claim a hazard exists without visual evidence.

## Today's goal (Oct 29)
Prove the core loop works end to end:
Upload image → Muse Spark analysis → SAM 3.1 localization → boxes drawn on image → JSON report.
MVP hazard category: **walkway obstruction only**. PPE and floor clutter come later.

## Stack
- `backend/`: Python 3.11+, FastAPI, Uvicorn, OpenAI Python SDK (Meta Model API is OpenAI-compatible), Pillow, python-dotenv, httpx
- `frontend/`: React + TypeScript + Vite + Tailwind
- No database. Store inspection results as JSON files in `backend/data/` for now.
- Deploy later: frontend on Netlify, backend on Render.

## Meta Model API
- Base URL: `https://api.meta.ai/v1`
- Key in `backend/.env` as `META_API_KEY`. Never commit `.env`. Never print the key.
- Reasoning model: `muse-spark-1.3` (do not use the `-contributor` variants; they let Meta use our images).
- Segmentation model: `sam-3.1` (text prompt like "cardboard boxes" → boxes + masks).
- Before writing SAM integration code, check the official docs / `github.com/meta-models/meta-sam` for the exact request and response format (image as base64 vs URL, box format). Don't guess.

## Pipeline (v1, live) and agent design (later)
v1 is a fixed pipeline in `backend/app/pipeline.py`, because SAM 3.1 returns EVERY instance of a noun
("cardboard box" -> 36 boxes in a cluttered scene) and long descriptive prompts usually return 0
(see `scripts/test_sam_prompts.py`):
1. detect: Muse lists findings, each with 1-2 short SAM nouns and a rough `approx_box`
2. segment: SAM runs the unique nouns in parallel (max 5 calls) -> numbered candidate boxes
3. verify: Muse sees the candidates drawn on the image and picks which belong to each finding; can dismiss findings
4. merge: union of picked boxes (`localization: "sam"`), else Muse's box (`"approximate"`), else null (`"none"`)
Rules in `rules.py` are applied in code after the models. Eval: `python scripts/run_pipeline.py` -> `backend/data/pipeline_runs/`.

The tool-calling agent (segment_object / check_safety_rule / create_inspection_report, max 4 iterations)
is a later upgrade that wraps the same pieces; build it only once v1 is solid.

## Conventions
- Bounding boxes from the backend are always `[x1, y1, x2, y2]` in ORIGINAL image pixels. The frontend scales to display size.
- Ask Muse Spark for structured JSON, validate with Pydantic models in `backend/app/schemas.py`.
- Each finding: `category, severity, observation, evidence, object, bounding_box, requires_human_review, recommendation`.
- Keep it simple. No auth, no video, no CCTV, no custom training.

## API contract (backend <-> frontend)
- `POST /api/inspect` with multipart field `image` (JPEG/PNG/WEBP, max 10 MB). Returns `InspectionReport` (see `backend/app/schemas.py`). Live calls take ~tens of seconds: show a loading state.
- `?mock=hazards` or `?mock=clean` returns a canned report (no API calls) with boxes rescaled to the uploaded image. Use this for frontend work.
- `GET /api/inspections/{inspection_id}` returns a saved live report.
- Report: `inspection_id, created_at, image_width, image_height, status ("possible_hazards_found" | "no_hazards_found"), scene_description, summary, findings[], disclaimer, models, timings_ms`.
- `image_width/height` are after EXIF rotation, i.e. what the browser displays. Scale boxes by displayed_width / image_width.
- Finding `localization`: `"sam"` = precise box (solid), `"approximate"` = Muse's rough box (draw dashed), `"none"` = `bounding_box` is null, show in the list only.
- Errors: 400 bad image, 413 too large, 422 missing field or bad `mock` value, 500 server missing API key, 502 Meta API failed.
- Changing the shape? Update `schemas.py`, the fixtures in `backend/app/fixtures/`, and this section, and tell your teammate.

## Dev environment (Windows)
- Backend: `cd backend`, `python -m venv .venv`, `.venv\Scripts\activate`, `pip install -r requirements.txt`, `uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend`, `npm install`, `npm run dev` (port 5173)
- CORS: backend allows `http://localhost:5173`.

## Layout
```
backend/
  app/
    main.py        # FastAPI app, POST /api/inspect, GET /api/health
    config.py      # settings from .env
    images.py      # upload validation, EXIF rotation
    meta_client.py # async Muse Spark + SAM calls
    pipeline.py    # detect -> segment -> verify -> merge
    agent.py       # tool-calling loop (later)
    rules.py       # safety rules
    schemas.py     # Pydantic models (API contract)
    fixtures/      # mock reports
  tests/           # pytest, uses a fake Meta client (no API calls)
  scripts/
    test_api.py          # standalone smoke test for Muse Spark + SAM
    test_sam_prompts.py  # SAM prompt-style experiment
    run_pipeline.py      # run the real pipeline on test_images, save annotated results
  data/
  .env             # gitignored
  .env.example
  requirements.txt
frontend/
  src/
test_images/       # demo images: 5-6 obvious obstructions + 1 clean scene
```
