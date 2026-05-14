# AI QA Copilot — Autonomous Engineering Manual

## Purpose

This file governs autonomous operation of the AI QA Copilot engineering organization. Read this before every session.

---

## Autonomous Engineering Behavior

- Act immediately. Never wait for user direction on engineering decisions.
- Read all memory files first, every session.
- Discover highest-impact work from `active_tasks.md` and `tech_debt.md`.
- Execute, validate, commit, push — in that order.
- Update memory files before stopping.
- Recursive improvement: after each fix, re-evaluate for newly unlocked work.

---

## Repository Layout

```
/                          Playwright framework root (TypeScript, strict)
  playwright.config.ts     Framework config — do NOT break CLI execution
  src/                     Page objects, fixtures, reporters, utilities
  tests/                   Test suites by type: smoke/regression/visual/api/ai-generated
  ui/
    server/                Express + ws backend (Node ESM, TypeScript)
      src/
        config.ts          FRAMEWORK_ROOT, ports, paths
        index.ts           Server bootstrap
        routes/            runs, tests, config, generateTest
        runner/            runRegistry, spawnRun
        ws/                logSocket (WebSocket streaming)
        utils/             playwright test discovery
    web/                   Vite + React 18 + Tailwind 3 frontend
      src/
        api/client.ts      Typed REST + evidence fetching
        hooks/             useRunStream (WS hook)
        pages/             Dashboard, RunDetails, History, NewTest, Settings
        components/        Terminal, ManagerTimeline, RunReport, ErrorBoundary, etc.
        styles/index.css   Design system via Tailwind @layer
  docs/memory/             Persistent engineering state (update every session)
```

---

## Role-Switching Protocol

Switch roles automatically based on work type:

| Trigger | Active Role |
|---------|-------------|
| API shape, data model, run lifecycle | Backend Engineer |
| Component, page, UX flow | Frontend Engineer |
| Correctness, coverage, reliability | QA Engineer |
| System topology, decoupling | Architect |
| User goals, priority | Product Owner |
| Code smell, duplication, drift | Self-Critique Reviewer |

Never announce role switches. Just do the work.

---

## Architectural Quality Standards

- No circular imports between layers (routes → runner → registry; web → api → hooks → components).
- Backend routes are thin: validation → delegate → respond. No business logic in routes.
- RunRegistry is the single source of truth for in-flight and historical runs.
- No shared mutable module state except RunRegistry singleton.
- FRAMEWORK_ROOT must be a single resolved path from env or relative resolution.
- WebSocket streaming is one-way: server pushes log/step/status events. Clients are read-only.
- Evidence is built once and cached (`_evidenceCache`) on terminal status.
- All `GET /api/runs/:id` responses exclude `logs`, `steps`, `_evidenceCache`, and `results` from the summary — these are large and served via dedicated endpoints.

---

## UI/UX Quality Standards

**Design system** (Tailwind tokens — do not invent ad hoc values):
- Surfaces: `bg-surface`, `bg-surface-1` … `bg-surface-5`
- Brand: `brand-300` (text), `brand-500` (interactive), `gradient-brand` (CTA)
- Card: `.card`, `.card-hover` — never raw `bg-` for elevated surfaces
- Buttons: `.btn-primary`, `.btn-ghost`, `.btn-danger` — never ad hoc button styles
- Inputs: `.input`, `.input-mono` — never raw `<input className="border …">`
- Tags: `<TagChip tag={t} />` — never inline tag rendering

**UX invariants:**
- Every async operation has: loading state → success state → error state.
- Empty states have a human message + next-action guidance.
- Errors surface as red banners, never silent console.error.
- Destructive actions (delete, cancel run) require confirmation or clear affordance.
- Navigation: sticky header, active-tab highlight, badge on History when run is active.
- No layout shift during loading (use skeleton rows, not spinners that change height).

---

## QA Expectations

- `npm run typecheck:ui` must be clean before every commit.
- `npm run build:ui` must be clean before every commit.
- `npm run typecheck` (framework) must be clean before every commit.
- After any backend change, mentally trace: spawn → registry → WS → frontend.
- After any frontend change, trace: mount → fetch → state → render → error path.
- Prefer concrete assertions over "looks fine".

---

## Refactoring Philosophy

- Prefer editing existing systems. Never create a parallel implementation.
- Delete dead code immediately — it accumulates cognitive debt.
- Extract only when duplication exceeds 3 instances or abstraction has a clear name.
- Inline when an abstraction is used once and adds no clarity.
- No backwards-compat shims. Change the callers.
- Tech debt has IDs (TD-xx) — always cross-reference with `tech_debt.md`.

---

## Self-Critique Behavior

After implementing any change, ask:
1. Is the response shape of every API endpoint documented and correct?
2. Does the frontend handle all three states (loading/success/error) for this endpoint?
3. Is there any leaked internal field in API responses?
4. Is there any debug console.log in production code?
5. Is there any hardcoded value that should be an env var or config?
6. Does any new component duplicate logic already in an existing component?
7. Is the new code exercisable without a live Playwright run?

---

## Simplicity & Cohesion

- One pattern per concern. History uses `runs.jsonl`; evidence uses `_evidenceCache`. Don't add a second cache layer.
- Co-locate related types: `RunRecord`, `LogChunk`, `StepPayload` live in `runRegistry.ts`.
- The frontend `client.ts` is the only file that knows about HTTP endpoints.
- `useRunStream` is the only file that knows about WebSocket protocol.

---

## Production-Grade Expectations

- No `console.log` debug statements in committed code.
- No hardcoded absolute paths (TD-02 already fixed; keep it that way).
- All file I/O is try/caught. Disk errors are non-fatal and logged to the run's log buffer.
- Path traversal protection on all asset-serving routes.
- Evidence cache is keyed per run, not shared.
- History JSONL append is atomic enough for single-writer usage. Do not add locking.

---

## Memory Rules

- `active_tasks.md`: sprint status + backlog with priority + known broken.
- `tech_debt.md`: debt items with ID, location, impact, effort. Resolved items move to "Resolved" section.
- `qa_findings.md`: bugs found (open) and fixed (resolved) with symptom/cause/fix.
- `session_log.md`: one entry per session, changes summary only — no prose.
- `architecture.md`: current system topology, key decisions, constraints.
- `product_vision.md`: user goals, non-goals, positioning.
- `ui_ux_direction.md`: design system, patterns, open UX decisions.

Keep all files concise. No narratives. Tables and bullet lists only.

---

## Stop Conditions

Stop when:
- All HIGH and CRITICAL items are resolved.
- Remaining items are LOW effort and LOW impact.
- Context quality is degrading (repeating same analysis without new findings).

Before stopping:
1. `npm run typecheck:ui && npm run build:ui && npm run typecheck`
2. `git add … && git commit && git push`
3. Update all memory files.
4. Record top 3 next opportunities in `active_tasks.md`.
