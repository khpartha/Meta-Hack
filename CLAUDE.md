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

## Agent design
Muse Spark runs a tool-calling loop with three tools:
1. `segment_object(prompt)` → calls SAM 3.1, returns boxes
2. `check_safety_rule(category, evidence)` → checks against rules in `backend/app/rules.py`
3. `create_inspection_report(findings)` → final structured output, ends the loop

Limits: max 4 loop iterations, max 3 SAM calls per inspection.

## Conventions
- Bounding boxes from the backend are always `[x1, y1, x2, y2]` in ORIGINAL image pixels. The frontend scales to display size.
- Ask Muse Spark for structured JSON, validate with Pydantic models in `backend/app/schemas.py`.
- Each finding: `category, severity, observation, evidence, object, bounding_box, requires_human_review, recommendation`.
- Keep it simple. No auth, no video, no CCTV, no custom training.

## Dev environment (Windows)
- Backend: `cd backend`, `python -m venv .venv`, `.venv\Scripts\activate`, `pip install -r requirements.txt`, `uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend`, `npm install`, `npm run dev` (port 5173)
- CORS: backend allows `http://localhost:5173`.

## Layout
```
backend/
  app/
    main.py        # FastAPI app, POST /api/inspect, GET /api/health
    meta_client.py # Muse Spark + SAM calls
    agent.py       # tool-calling loop
    rules.py       # safety rules
    schemas.py     # Pydantic models
  scripts/
    test_api.py    # standalone smoke test for Muse Spark + SAM
  data/
  .env             # gitignored
  .env.example
  requirements.txt
frontend/
  src/
test_images/       # demo images: 5-6 obvious obstructions + 1 clean scene
```
