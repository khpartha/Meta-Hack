# SceneGuard AI

SceneGuard AI is an AI-assisted visual safety inspection tool for warehouses. You upload a photo of a workplace. The backend asks Meta's Muse Spark model to look for possible hazards, uses SAM 3.1 to find where each hazard is in the image, and returns a JSON report plus the image with boxes drawn on it. The first version only checks for walkway obstructions. SceneGuard is not a certified compliance system: it reports every finding as a *possible* hazard for a person to review.

## Prerequisites

- Python 3.11+
- Node.js 20+ (includes npm)
- Git
- A Meta Model API key (ask the team for one)

## Setup

### 1. Clone

```bash
git clone <repo-url>
cd <repo-folder>
```

### 2. Backend

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

**Mac (Terminal)**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and put your key after `META_API_KEY=`. Never commit `.env`; it's already in `.gitignore`.

### 3. Frontend

Same on Windows and Mac:

```bash
cd frontend
npm install
```

## Running

Use two terminals. Start both from the repo root.

**Terminal 1: backend** (http://localhost:8000)

```bash
cd backend
# Windows: .venv\Scripts\activate
# Mac:     source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2: frontend** (http://localhost:5173)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173. The page should show **Backend: ok**. During development, Vite forwards `/api/*` requests to the backend on port 8000.

### API smoke test (optional)

This test checks that your key works with Muse Spark and SAM 3.1. Put at least one image in `test_images/`, then run this with the backend venv active:

```bash
cd backend
python scripts/test_api.py
```

## Project layout

```
backend/
  app/            FastAPI app (main.py), Meta API client, agent loop, rules, schemas
  scripts/        test_api.py: standalone smoke test
  data/           inspection results as JSON (gitignored)
  .env.example    copy to .env and add your META_API_KEY
frontend/         React + TypeScript + Vite + Tailwind
test_images/      demo images
```
