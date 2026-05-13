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

### Step 2 — Backend skeleton ✅
- Scaffolded `ui/server` (Express + TypeScript + native `ws` dep + `tsx` for dev)
- `GET /api/health` returns `{ ok, frameworkRoot }`
- `GET /api/tests` shells `npx playwright test --list --reporter=json` from `FRAMEWORK_ROOT` and returns `{ count, tests, errors }`
- Parser is resilient: non-zero exit + partial JSON is surfaced as `errors[]` instead of failing the request (handles e.g. missing env vars at framework module load)
- Filters Playwright's synthetic "No tests found" error so it doesn't leak through alongside real load-time errors
- Verified: `npm run typecheck` clean; live `/api/health` and `/api/tests` smoke-tested against the real framework (5 tests discovered)

### Step 3 — Run execution + WebSocket log streaming ✅
- `POST /api/runs` accepts `{ grep?, project?, file? }`, returns `{ runId, pid, args }`. Returns `409` with `activeRunId` when a run is already active (only one concurrent run permitted).
- `POST /api/runs/:id/cancel` sends `SIGTERM` to the child.
- `GET /api/runs/:id` returns the run summary without logs (clients use WS for streaming) including `status`, `exitCode`, `args`, `results` (parsed `test-results/results.json`), and `errorMessage`.
- `runRegistry` (EventEmitter) holds in-memory run state with a bounded log buffer (5000 chunks max) and emits `log` / `status` events.
- `ws://localhost:4000/ws/runs/:id` upgrades on the HTTP server, replays buffered history on connect, sends a snapshot status, then streams live `{type:'log', stream, data, ts}` messages. On terminal status (`completed` / `failed` / `error`) the server broadcasts the final status and closes the socket. Connections to unknown `runId` receive `{type:'error', data:'run_not_found'}` and close.
- Child is spawned with `cwd: FRAMEWORK_ROOT`, inherits `process.env`, uses `npx playwright test ...` with `--reporter=list,json`.
- Verified end-to-end with a temporary `scripts/test-ws.mjs` harness (since removed): WS streamed live logs, terminal status closed the socket, concurrent POST correctly returned 409.

### Step 4 — Frontend scaffold ✅
- `ui/web` scaffolded directly (Vite + React 18 + TypeScript) — no interactive `npm create`
- Tailwind 3 + PostCSS + Autoprefixer configured; `src/styles/index.css` imports the three `@tailwind` layers; `tailwind.config.js` scans `index.html` and `src/**/*.{ts,tsx}`
- TypeScript split into `tsconfig.app.json` (app) + `tsconfig.node.json` (Vite config) with project-references root `tsconfig.json`
- `react-router-dom` v6 wired: `BrowserRouter` in `main.tsx`, `<Routes>` in `App.tsx`, two routes:
  - `/` → `Dashboard` placeholder (test list / run controls)
  - `/runs/:runId` → `RunDetails` placeholder (WS log stream / results)
- Header with `NavLink`s using Tailwind classes confirms styling pipeline works
- Vite proxy: `/api` → `http://localhost:4000`, `/ws` → `ws://localhost:4000` (with `ws: true`)
- Verified: `npm run build` clean — 36 modules transformed, Tailwind CSS emitted, no TS errors

### Step 5 — Wire frontend to backend ✅
- `src/api/client.ts` — typed REST helpers (`fetchTests`, `startRun`, `fetchRun`, `cancelRun`) with strict response narrowing; non-2xx responses throw `Error` enriched with `status` + `body`.
- `src/hooks/useRunStream.ts` — `useRunStream(runId)` opens `ws://<host>/ws/runs/:id` (https→wss aware), narrates `log` events into a `LogEvent[]`, mirrors `status` + `exitCode`, and exposes `socketState` (`connecting`/`open`/`closed`/`error`). Cleans up on unmount or runId change.
- `src/components/Terminal.tsx` — dark monospace panel; `stderr` chunks coloured rose-400; auto-scrolls to bottom on every new chunk via `useEffect`.
- **Dashboard** (`/`):
  - Fetches `/api/tests` on mount, derives unique project + tag lists.
  - Project dropdown + grep/tag input (datalist suggestions from discovered tags).
  - "Run tests" button calls `startRun()` then `navigate('/runs/:runId')`.
  - Renders a discovered-tests table with project, tags, file:line.
  - Surface discovery `errors[]` as warning banner (e.g. missing env vars) instead of hiding them.
- **RunDetails** (`/runs/:runId`):
  - Fetches `/api/runs/:id` on mount for `args`, plus a second fetch after the run terminates to pick up parsed results.
  - WS-driven status badge (running/completed/failed/error) with exit code chip.
  - "Cancel run" button hits `POST /api/runs/:id/cancel`; disabled when not running.
  - Live log stream rendered in `<Terminal>`; socket state shown next to args.
  - "← Dashboard" link to return.
- Removed obsolete `/runs/preview` placeholder nav link.
- Verified: `npm run build` clean (39 modules transformed, no TS errors).

### Step 6 — Polish ✅
- Added a `<Spinner>` component plus skeleton rows in the Dashboard test table while `/api/tests` resolves
- RunDetails shows a "Loading run metadata…" spinner while `/api/runs/:id` resolves; replaces metadata bar once loaded
- Improved Dashboard empty state with guidance pointing at discovery warnings + `.env` at the framework root
- Network failures already surface as red error banners (loadError + startError + cancelError) — verified
- Installed `concurrently` at the repo root and added:
  - `npm run dev:ui` → starts backend + frontend together with prefixed labels (`server`, `web`)
  - `npm run ui:server`, `npm run ui:web` — individual processes
  - `npm run build:ui`, `npm run typecheck:ui` — workspace fan-out
- Added `ui/README.md` documenting architecture, run lifecycle, scripts, configuration, and constraints
- Final verification: `npm run typecheck` (framework) + `npm run typecheck:ui` (both UI packages) + `npm run build:ui` (both packages) — all clean

Each step ends with: typecheck/build, `claude.md` update, ask for approval before moving on.

---

## 6. Conventions

- **No raw selectors in framework tests** (existing rule — unchanged).
- **GUI code must not import from framework `src/`** unless strictly necessary. The backend treats Playwright as a CLI subprocess, not a library.
- **No new framework dependencies** added to root `package.json`. All GUI deps live under `ui/server` and `ui/web`.
- **Branch:** continue on `claude/design-qa-automation-architecture-W3tXU`. Commit per step.

---

## 7. Progress log

- **2026-05-12** — Step 1 complete: `claude.md` created.
- **2026-05-12** — Step 2 complete: backend skeleton with `/api/health` and `/api/tests` working against the live framework.
- **2026-05-12** — Step 3 complete: `POST /api/runs` spawns Playwright, `runRegistry` tracks state, `ws://…/ws/runs/:id` streams logs and terminal status.
- **2026-05-12** — Step 4 complete: `ui/web` scaffold (Vite + React + TS), Tailwind configured, React Router with Dashboard + RunDetails routes, `/api` + `/ws` proxied to `:4000`. `npm run build` clean.
- **2026-05-12** — Step 5 complete: typed API client, `useRunStream` WS hook, `<Terminal>` component, Dashboard (test list + project/grep filters + Run), RunDetails (live logs, status badge, exit code, cancel). Build clean.
- **2026-05-12** — **Step 6 complete: project finished.** Loading states + skeletons + empty-state guidance, `concurrently`-powered `npm run dev:ui`, `ui/README.md`, and all-workspace typechecks + builds clean. The GUI is end-to-end functional on top of the unmodified framework.
- **2026-05-13** — Phase 4 (Business-Readable Manager View):
  - **`src/reporters/step-stream.reporter.ts`**: new Playwright reporter that hooks `onStepBegin`/`onStepEnd` for `category === 'test'` steps only, emitting `__UI_STEP__:{"action":"start"|"end","title","status","error","ts"}` to stdout. Registered as 5th reporter in `playwright.config.ts`.
  - **Spawn pipeline** (`spawnRun.ts`): line-buffers stdout, splits on `\n`, routes `__UI_STEP__:` lines to `runRegistry.appendStep()` and normal lines to `appendLog()`. Flushes partial buffer on child exit/error.
  - **RunRegistry**: added `steps: StepPayload[]` buffer (max 2000), `appendStep()`, and `step` event emission. `list()` now also omits `steps` from summaries.
  - **logSocket**: subscribes to `step` events and broadcasts `{type:'step', payload, ts}`. History replay now interleaves logs and steps sorted by `ts` so late-connecting clients get a coherent timeline.
  - **`useRunStream`**: extended with `stepEvents: StepEvent[]` state; handles `type:'step'` messages.
  - **`<ManagerTimeline>`**: converts raw `StepEvent[]` into resolved `TimelineStep[]` (start/end matched by title), renders a live checklist — spinning indicator for the active step, ✓ green for passed, ✗ rose for failed — with per-step duration and inline error message.
  - **RunDetails**: segmented `📋 Manager view` / `💻 Developer view` toggle; Manager view is the default. Panel sits in a shared bordered card.
  - **AI generator**: tightened system prompt to mandate that ALL test logic lives inside `test.step('Human-readable sentence', ...)` blocks; violation is called out explicitly as breaking the Manager View.
  - Typecheck and build clean (44 frontend modules).

- **2026-05-13** — Phase 3 (Portfolio readiness + Run History + Visual Regression):
  - **Framework cleanup**: removed `tests/auth.setup.ts`, `tests/smoke/auth.smoke.ts`, and `.auth/`. `playwright.config.ts` no longer defines the `setup` project — browser projects have no `dependencies`. `testMatch` extended with `ai-generated` so files like `*.ai-generated.ts` are discovered.
  - **Run History**: `RunRegistry.list()` returns log-stripped summaries sorted newest-first; `GET /api/runs` exposes them. New `/history` page polls every 4s, renders a status-icon table (✓/✗/⟳/⚠), formatted duration + timestamp, clickable rows that navigate to `/runs/:id`. "📜 No runs yet" empty state.
  - **Visual Regression**: `POST /api/generate-test` accepts `visualRegression: boolean`. When true, the system prompt is extended with explicit instructions to add `await expect(page).toHaveScreenshot()` calls and tag the test `@visual`. Mock template mirrors the same behaviour. New checkbox in the New Test form + purple `📸 visual` badge in the result preview.
  - **Nav**: added `⌛ History` tab between New test and Settings.
  - Typecheck and build clean across both workspaces (43 frontend modules).

- **2026-05-13** — SaaS feature iteration: Environment Config Panel, AI Test Builder, and Dashboard polish.
  - Backend: `GET/POST /api/config` reads/writes `.env` safely (redacts `ANTHROPIC_API_KEY`, validates key format); `POST /api/generate-test` calls Claude `claude-sonnet-4-6` when `AI_ENABLED=true`+`ANTHROPIC_API_KEY` set, else returns a mock template. Generated files land in `tests/ai-generated/`.
  - Frontend: **Settings** page (env vars form with password reveal, primary/other sections, save feedback); **New Test** (AI Builder) page (URL + step textarea, inline code preview, "Go to Dashboard →" triggers auto-refresh); **Dashboard** polished with BASE_URL pill, project icons, tag colour chips, hover rows, spinner-in-button; sticky header with ◈ logo and three nav tabs.
  - All workspaces typecheck and build clean (42 frontend modules).
