# AI QA Copilot — Web GUI

A web-based control panel for running the Playwright test suite, streaming live logs, and inspecting results.

The GUI is two independent packages that live alongside (not inside) the test framework:

- **`ui/server`** — Express + TypeScript + `ws`. Spawns `npx playwright test` as a child process and streams stdout/stderr over WebSockets.
- **`ui/web`** — Vite + React + TypeScript + TailwindCSS. Single-page UI that talks to the server over `/api` (REST) and `/ws` (WebSocket).

The framework itself (`playwright.config.ts`, `tests/`, `src/`) is untouched — the GUI treats Playwright as a CLI subprocess, not a library.

---

## Quick start

From the repo root:

```bash
# 1. Install GUI deps (first time only)
npm --prefix ui/server install
npm --prefix ui/web install

# 2. Start both servers concurrently
npm run dev:ui
```

That brings up:

- Backend API at <http://localhost:4000>
- Frontend at  <http://localhost:5173> (Vite proxies `/api` and `/ws` to `:4000`)

Open <http://localhost:5173> in a browser. The dashboard lists discovered tests; pick a project and/or grep filter, click **Run tests**, and you'll be navigated to the live log view for the spawned run.

Stop both with `Ctrl-C` once.

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│ Browser — http://localhost:5173                      │
│                                                       │
│  React + Vite + Tailwind                              │
│   ├── /          Dashboard (test list, run controls)  │
│   └── /runs/:id  Live logs, status, cancel            │
└────────────────────────┬──────────────────────────────┘
                         │ /api  (REST)
                         │ /ws   (WebSocket, ws upgrade)
                         ▼
┌───────────────────────────────────────────────────────┐
│ Backend — http://localhost:4000                       │
│                                                       │
│  Express + native `ws`                                │
│   GET  /api/health                                    │
│   GET  /api/tests             discovered tests        │
│   POST /api/runs              start a run             │
│   GET  /api/runs/:id          summary + results       │
│   POST /api/runs/:id/cancel   SIGTERM the child       │
│   WS   /ws/runs/:id           log + status stream     │
│                                                       │
│  Spawns: npx playwright test ...                      │
│  CWD:    FRAMEWORK_ROOT (repo root by default)        │
└───────────────────────────────────────────────────────┘
```

**Run lifecycle:**

1. `POST /api/runs` → `runRegistry.create(runId)`, child spawned, response with `{ runId, pid, args }`. A second concurrent POST returns `409` with the active `runId`.
2. Browser navigates to `/runs/:runId` and opens `ws://localhost:4000/ws/runs/:runId`.
3. On connect, the server replays buffered log history and sends a snapshot status.
4. Live `{ type: 'log', stream, data, ts }` frames stream every chunk; the `Terminal` component auto-scrolls.
5. On child exit, `{ type: 'status', status, exitCode }` is broadcast and the socket closes. The frontend re-fetches `/api/runs/:id` to pick up the parsed `test-results/results.json`.

---

## Available scripts (root)

| Script | Purpose |
|---|---|
| `npm run dev:ui` | Start backend + frontend together (`concurrently`) |
| `npm run ui:server` | Backend only (`tsx watch`) |
| `npm run ui:web` | Frontend only (`vite`) |
| `npm run build:ui` | Production build for both packages |
| `npm run typecheck:ui` | TypeScript typecheck for both packages |

---

## Configuration

The backend resolves the framework root relative to its own file location (`ui/server/src/config.ts` → `../../..`), so it works regardless of the CWD that launched it. Override with `FRAMEWORK_ROOT=/abs/path npm run ui:server` if you're pointing it at a different checkout. `PORT` defaults to `4000`.

The frontend's Vite proxy target defaults to `http://localhost:4000`; override with `UI_API_TARGET=http://host:port npm run ui:web`.

The test framework still requires its own `.env` (see the root README). When env vars are missing the dashboard surfaces Playwright's discovery errors as a warning banner instead of hiding them.

---

## Constraints

- **One active run at a time** — second concurrent `POST /api/runs` returns `409`.
- **In-memory state** — no DB; refreshing the page after a run keeps the summary fetchable via `GET /api/runs/:id` until the server is restarted. Logs are bounded to 5000 chunks per run.
- **No auth** — bind to `localhost` or put it behind a reverse proxy if exposing externally.
