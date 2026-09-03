# PaRo App - Local Run and Verification Guide

This guide helps you run the project locally and verify the implemented flows (including S2 sync control).

## 1) Prerequisites

- Windows machine
- Python virtual environment already present at .venv
- Node.js + npm installed

## 2) Project structure

- Backend: api
- Frontend: web
- Database file: data/paro.db

## 3) Environment setup

1. Open a terminal at repo root.
2. Activate Python environment:

   source .venv/Scripts/activate

3. Ensure backend env file exists (api/.env). If missing, copy from .env.example and adjust values.

## 4) Run backend

In a terminal from repo root:

1. Move to backend folder:

   cd api

2. Apply migrations:

   ../.venv/Scripts/python.exe -m alembic upgrade head

3. Start API server:

   ../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

Expected:
- API available at http://127.0.0.1:8000
- Health endpoint: http://127.0.0.1:8000/health

## 5) Run frontend

Open a second terminal from repo root:

1. Move to frontend folder:

   cd web

2. Install dependencies (only first time or when package changes):

   npm install

3. Start dev server:

   npm run dev

Expected:
- UI available at URL shown by Vite (commonly http://127.0.0.1:5173)

## 6) Quick validation commands

From repo root:

Backend tests:

- cd api
- ../.venv/Scripts/python.exe -m pytest -q

Frontend production build:

- cd web
- npm run build

## 7) How to verify S1 and S2 in UI

1. Open Admin screen in the frontend.
2. S1 Universe Upload:
- Upload the CSV from Nifty Shares Viewer Wireframe/uploads.
- Confirm success summary, preview rows, and timestamp.
- Test replace flow and cancel behavior.

3. S2 Sync Control:
- Click Full Sync or Incremental Sync.
- Confirm buttons disable while run is active.
- Confirm status card updates processed/updated/failed counts.
- Confirm Recent Sync Logs populates and selecting a run shows Run Detail rows.
- If a run has failed symbols, use Retry failed and confirm a new run starts.

## 8) Useful troubleshooting

- If frontend cannot call backend, ensure backend is running and CORS is enabled in backend app config.
- If migration fails due to DB path, run commands exactly from api folder as shown above.
- If stale data causes confusion, stop services and remove data/paro.db, then re-run migrations.

## 9) Optional API checks

Open these in browser or API client:

- GET /health
- GET /universe
- GET /admin/sync/status
- GET /admin/sync/runs

Base URL for API calls:
- http://127.0.0.1:8000
