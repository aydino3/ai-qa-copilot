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

## Queued / Backlog

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 1 | History page: persist runs to disk (JSON) | MED | Restarts wipe all history |
| 2 | RunDetails: auto-refresh evidence on re-run | MED | Currently requires page reload |
| 3 | Dashboard: add "last run status" badge per test card | HIGH | Managers need quick pass/fail at a glance |
| 4 | ImageCompareSlider: magnifier math on non-square images | LOW | May mis-centre on tall screenshots |
| 5 | NewTest: save/load step templates | LOW | UX improvement |
| 6 | Evidence: download all artifacts as ZIP | LOW | Nice-to-have for report sharing |
| 7 | CI integration docs / GitHub Actions example | MED | Users need CI guide |
| 8 | History: real-time badge on navbar ("1 running") | MED | Global status indicator |
| 9 | Step-stream reporter: emit spec-level start/end | LOW | Enables per-test live progress in Manager timeline |
| 10 | Config: validate BASE_URL is reachable before run | LOW | Better error messages |

## Known Broken / Needs Watch
- `config.ts` line 12: `TS2881 "This expression is never nullish"` — pre-existing, not blocking
- Mock test generator step body is `// TODO: implement` — by design, user fills it in
- `History.tsx` stat cards use `animate-count-up` CSS class — works but values don't actually animate (numbers don't count up from 0)
