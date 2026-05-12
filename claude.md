# AI QA Copilot — GUI Project Memory

This file is the central context document for adding a web-based GUI to the existing Playwright + TypeScript QA framework. Update it after every major step so context survives across sessions.

---

## 1. Existing framework (do not modify unless required)

- **Stack:** Playwright 1.44 + TypeScript 5.4, strict mode, path aliases (`@pages/*`, `@fixtures/*`, `@utils/*`, `@ai/*`, `@test-data/*`)
- **Test layout:** `tests/{smoke,regression,visual,api}/*.{smoke,regression,visual,api}.ts` + `tests/auth.setup.ts`
- **Projects:** `setup` (auth state), `chromium`, `firefox`, `mobile-safari`, `api`
- **Reporters:** `list`, `html` (→ `playwright-report/`), `json` (→ `test-results/results.json`), custom `ai-enhanced.reporter.ts`
- **Scripts:** `test`, `test:smoke`, `test:regression`, `test:visual`, `test:api`, `test:ci`, `report`, `lint`, `typecheck`
- **Env:** `requireEnv()` fail-fast at module load; AI features gated by `AI_ENABLED` + `ANTHROPIC_API_KEY`

The GUI must NOT modify framework behavior. Tests must remain runnable from CLI exactly as today.

---

## 2. GUI goals

1. List available tests (parsed from Playwright's `--list --reporter=json`)
2. Trigger runs (full suite, by tag, by file, by project) from the browser
3. Stream live Playwright stdout/stderr to the browser via WebSocket
4. Show structured results when a run finishes (parsed from `test-results/results.json`)
5. Link to the existing HTML report (`playwright-report/index.html`)

Non-goals (for now): authentication, multi-user, run history persistence, scheduling, container orchestration.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React + Vite + Tailwind, port 5173)       │
│  ├── Test list view                                 │
│  ├── Run controls (tags, projects, file filter)     │
│  ├── Live log terminal (xterm.js or <pre> stream)   │
│  └── Results panel + HTML report link               │
└──────────────┬──────────────────────────────────────┘
               │ HTTP (REST) + WebSocket (logs)
               ▼
┌─────────────────────────────────────────────────────┐
│  Backend (Node + Express + ws, port 4000)           │
│  ├── GET  /api/tests          list discovered tests │
│  ├── POST /api/runs           start a Playwright run│
│  ├── GET  /api/runs/:id       run status + results  │
│  ├── GET  /api/runs/:id/report  serve HTML report   │
│  └── WS   /ws/runs/:id        stream stdout/stderr  │
│                                                     │
│  Spawns: `npx playwright test ...` via child_process│
│  CWD:    repo root (reuses existing config/env)     │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**

- **Monorepo layout** under `ui/` — keeps framework root clean. Two sub-packages: `ui/server` and `ui/web`. No workspace tooling (npm workspaces) unless it becomes necessary; each sub-package has its own `package.json`.
- **Process model:** backend spawns `npx playwright test ...` as a child process with the repo root as CWD. Inherits `.env`. One in-flight run per `runId`; runs are tracked in an in-memory `Map<runId, RunState>`. No DB.
- **Log streaming:** native `ws` (not Socket.io) — smaller surface area, no client lib needed beyond browser `WebSocket`. Each WS connection is bound to a `runId` and replays a small buffered history on connect.
- **Results:** parsed from `test-results/results.json` once the child exits. Backend caches per `runId`.
- **HTML report:** Express static-serves `playwright-report/` on `/api/runs/:id/report` (proxied through Vite in dev).
- **Frontend dev server:** Vite with `/api` + `/ws` proxy to backend.

---

## 4. File structure (target)

```
ui/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts            # Express + ws bootstrap
│   │   ├── routes/
│   │   │   ├── tests.ts        # GET /api/tests
│   │   │   └── runs.ts         # POST /api/runs, GET /api/runs/:id
│   │   ├── runner/
│   │   │   ├── spawnRun.ts     # child_process.spawn wrapper
│   │   │   └── runRegistry.ts  # in-memory run state + log buffer
│   │   ├── ws/
│   │   │   └── logSocket.ts    # ws server, runId routing
│   │   └── utils/
│   │       └── playwright.ts   # list tests, parse results.json
│   └── .env.example
└── web/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── client.ts
        │   └── socket.ts
        ├── components/
        │   ├── TestList.tsx
        │   ├── RunControls.tsx
        │   ├── LogStream.tsx
        │   └── ResultsPanel.tsx
        └── styles/index.css
```

---

## 5. Roadmap

### Step 1 — Setup & planning (current)
- Inspect repo, write this `claude.md`. **No code yet.**

### Step 2 — Backend skeleton
- Scaffold `ui/server` (Express + TypeScript + ws + tsx for dev)
- Health endpoint, basic Express app, listen on `:4000`
- `GET /api/tests` → shells `npx playwright test --list --reporter=json` and returns parsed test list
- Typecheck + smoke-run the endpoint

### Step 3 — Run execution + WebSocket log streaming
- `POST /api/runs` → spawns Playwright child process, returns `runId`
- `runRegistry` keeps log buffer + status (`running`/`passed`/`failed`)
- `ws://…/ws/runs/:id` streams stdout/stderr; replays buffered history on connect
- `GET /api/runs/:id` returns parsed `results.json` once child exits

### Step 4 — Frontend scaffold
- `npm create vite@latest ui/web -- --template react-ts`
- Install Tailwind, configure
- Skeleton layout: sidebar (test list), main (controls + logs + results)
- Vite proxy for `/api` and `/ws`

### Step 5 — Wire frontend to backend
- Test list fetch + render
- Run controls (tag/project/file filter) → POST `/api/runs`
- Live log component subscribes to WS, appends to scrolling view
- Results panel renders parsed results when run completes
- Link button → existing HTML report

### Step 6 — Polish
- Empty/error states, run cancellation, simple run-in-progress indicator
- README update for the GUI; commands to start both servers
- Final typecheck + manual smoke test of the full flow

Each step ends with: typecheck/build, `claude.md` update, ask for approval before moving on.

---

## 6. Conventions

- **No raw selectors in framework tests** (existing rule — unchanged).
- **GUI code must not import from framework `src/`** unless strictly necessary. The backend treats Playwright as a CLI subprocess, not a library.
- **No new framework dependencies** added to root `package.json`. All GUI deps live under `ui/server` and `ui/web`.
- **Branch:** continue on `claude/design-qa-automation-architecture-W3tXU`. Commit per step.

---

## 7. Progress log

- **2026-05-12** — Step 1 complete: `claude.md` created. Awaiting approval to start Step 2 (backend skeleton).
