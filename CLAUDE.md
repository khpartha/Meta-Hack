I'm joining a hackathon project as a second developer. Help me get set up and start contributing.

PROJECT: SceneGuard AI
An AI-assisted visual safety inspection tool for warehouses. A user uploads a workplace photo; an AI agent looks for possible hazards, locates the relevant objects, and returns an annotated inspection report with findings, bounding boxes, and recommended actions. It's framed as an inspection assistant, not a certified compliance system: every finding is a "possible" hazard that needs human review, and the app must never claim a hazard without visual evidence.

Deadline: Nov 4, 2026. MVP hazard category: walkway obstruction only.

REPO: https://github.com/khpartha/Meta-Hack
Read CLAUDE.md in the repo root first. It's the source of truth for architecture, conventions, and folder layout.

STACK
- backend/: Python 3.11+, FastAPI, OpenAI Python SDK pointed at Meta Model API (https://api.meta.ai/v1), Pillow
- frontend/: React + TypeScript + Vite + Tailwind
- AI: Meta Muse Spark 1.3 (scene reasoning, tool calling) + SAM 3.1 (object segmentation from a text prompt)
- No database; JSON files for now.

HOW IT WORKS
POST /api/inspect receives an image → Muse Spark runs an agent loop with three tools: segment_object (calls SAM), check_safety_rule, create_inspection_report → returns structured JSON. Max 4 loop steps, max 3 SAM calls.

CURRENT STATUS (Oct 29)
- Done: repo set up, FastAPI backend with GET /api/health, React frontend that calls it and shows "Backend: ok".
- In progress: Meta API key and billing; smoke-testing Muse Spark and SAM with backend/scripts/test_api.py.
- Next: the agent loop and /api/inspect endpoint (backend), then the results UI (frontend).

THE CONTRACT BETWEEN FRONTEND AND BACKEND
POST /api/inspect (multipart, field "file": a JPG/PNG image or an MP4/MOV video, max 50 MB) returns:
{
  "inspection_id": "string",
  "media_type": "image" | "video",
  "status": "review_required" | "no_findings",
  "frame_width": number,
  "frame_height": number,
  "duration_sec": number,
  "frames": [
    {
      "timestamp_sec": number,
      "findings": [
        {
          "category": "walkway_obstruction",
          "severity": "low" | "medium" | "high",
          "observation": "string",
          "evidence": "string",
          "object": "string",
          "bounding_box": [x1, y1, x2, y2],
          "requires_human_review": boolean,
          "recommendation": "string"
        }
      ]
    }
  ]
}
- An image, or a single camera/live frame, is one frame at timestamp_sec 0 (duration_sec 0).
- A video has one entry per analyzed moment; frames with no findings may be included with an empty list.
- bounding_box is always in ORIGINAL media pixels (frame_width x frame_height); the frontend scales it to the displayed size.
- Camera snapshots and live-monitoring frames are sent to the same endpoint as JPEG images.
- Transition note: the backend on quin/pipeline still returns the older flat shape (image_width/image_height + a top-level findings list) and reads the field "image". The frontend (src/api/inspect.ts) also accepts that flat shape for now, but the field name must change to "file" on one side for real requests to work.

MY ROLE: FRONTEND
1. Image upload (drag-and-drop + file picker, preview).
2. Call POST /api/inspect, show a loading/progress state (the agent can take 10–30 seconds).
3. Draw bounding boxes over the image, scaled correctly, labeled by finding.
4. Show findings as cards: category, severity badge, observation, evidence, recommendation, "needs human review" tag.
5. Handle "no findings" and error states clearly.
Until the real endpoint exists, build against a mock: frontend/src/mocks/image-inspection.json and video-inspection.json match the contract above. Set VITE_USE_MOCK=true in frontend/.env.local to use them (copy frontend/.env.example); otherwise the frontend calls VITE_API_URL (default http://localhost:8000).

TEAM WORKFLOW
- My teammate works on the backend; I work on the frontend.
- I work on a branch (e.g. frontend-ui), never directly on main.
- Before starting each session: git pull origin main, then merge main into my branch.
- Commit small and often; open a pull request to main when a piece works.
- Never commit .env or API keys. The key goes only in backend/.env (already gitignored).
- If I change the API contract or architecture, update CLAUDE.md in the same commit so we stay in sync.

SETUP (Windows)
1. git clone https://github.com/khpartha/Meta-Hack.git
2. Backend: cd backend, python -m venv .venv, .venv\Scripts\activate, pip install -r requirements.txt, copy .env.example to .env (teammate will share the key privately), uvicorn app.main:app --reload --port 8000
3. Frontend: cd frontend, npm install, npm run dev → http://localhost:5173

Start by helping me clone and run the project, confirm I see "Backend: ok" on the page, then create my branch and build the mock-driven upload + results UI.