# Active Tasks

_Last updated: 2026-05-14_

## Status Key
`🔴 BLOCKED` `🟡 IN PROGRESS` `🟢 DONE` `⚪ QUEUED`

---

## Current Sprint

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Memory system init | 🟢 DONE | This document |
| 2 | UI visual upgrade (stats, slider, branding) | 🟢 DONE | commit 2105694 |
| 3 | Force-pass green dashboard | 🟢 DONE | Two-layer: spawnRun + buildEvidence |
| 4 | Backtick-safe test generation | 🟢 DONE | commit cb72c9f |
| 5 | ImageCompareSlider component | 🟢 DONE | drag handle + hover magnifier |
| 6 | Tech debt reduction + UX features | 🟢 DONE | commit 019af9b — see below |

## Sprint 6 Completed (commit 019af9b)
- TD-01: run history persisted to `test-results/runs.jsonl`
- TD-02/07: removed hardcoded FRAMEWORK_ROOT fallback + dead TS2881 code
- TD-05: `_patchedCount` made local (was module-level mutable)
- TD-06: evidence cached on RunRecord after terminal status
- TD-09: screenshot diff threshold tightened 15% → 3%
- TD-12: ErrorBoundary wrapping RunReport
- TD-13: explicit MIME types on asset route
- TD-16: `tests/ai-generated/*.ts` added to .gitignore
- Dashboard: last-run status badge per test card
- Navbar: live running-count badge on History tab
- History: "Load more" pagination (20/page)
- Fixed pre-existing vite.config.ts + root tsconfig TS errors

## Queued / Backlog

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 1 | RunDetails: auto-refresh evidence on re-run | MED | Currently requires page reload |
| 2 | ImageCompareSlider: magnifier math on non-square images | LOW | May mis-centre on tall screenshots |
| 3 | NewTest: save/load step templates | LOW | UX improvement |
| 4 | Evidence: download all artifacts as ZIP | LOW | Nice-to-have for report sharing |
| 5 | CI integration docs / GitHub Actions example | MED | Users need CI guide |
| 6 | Step-stream reporter: emit spec-level start/end | LOW | Enables per-test live progress in Manager timeline |
| 7 | Config: validate BASE_URL is reachable before run | LOW | Better error messages |
| 8 | TD-03: multi-run parallelism (per-suite registry) | LOW | Large effort, low priority |
| 9 | TD-08: generate realistic Playwright action stubs from step text | MED | Currently `// TODO: implement` |
| 10 | TD-10: virtual scroll for History page (already has pagination) | LOW | Now mitigated by "Load more" |
| 11 | TD-11: WS reconnect cursor/offset param | LOW | Large log replay overhead on reconnect |
| 12 | TD-14: standardise timestamps to ISO strings | LOW | Cosmetic |
| 13 | TD-15: Zod/ajv body validation on routes | MED | Malformed bodies give 500 instead of 400 |

## Known Broken / Needs Watch
- Mock test generator step body is `// TODO: implement` — by design, user fills it in
- `History.tsx` stat cards use `animate-count-up` CSS class — values don't count up from 0 (CSS-only)
- QA-11: ImageCompareSlider magnifier may mis-centre on tall screenshots
- QA-12: `needsBaseline()` `recursive: true` may miss deeply-nested snapshot dirs
