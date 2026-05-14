# Active Tasks

_Last updated: 2026-05-14_

## Status Key
`🔴 BLOCKED` `🟡 IN PROGRESS` `🟢 DONE` `⚪ QUEUED`

---

## Resolved This Session

| Commit | Work |
|--------|------|
| ebcf23f | CRITICAL: Remove visual regression system completely — toHaveScreenshot, ImageCompareSlider, needsBaseline, patchBaselineResults, forcePass, visualRegression checkbox, baseline/actual/diff fields |
| ebcf23f | Multi-agent scaffold: scripts/autonomous-run.js (6-role orchestration), scripts/agents/roles.js, .github/workflows/daily-autonomous.yml (daily cron) |

---

## Remaining Backlog

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 1 | RunDetails: auto-refresh evidence after re-run (no page reload) | MED | Requires polling or WS event trigger |
| 2 | Dashboard: run filter by tag directly from test card chip | MED | Click @smoke → filter + run |
| 3 | CI guide / GitHub Actions example for framework tests | MED | Users need CI docs |
| 4 | Settings: validate BASE_URL is reachable before run | LOW | Better first-run DX |
| 5 | Step-stream reporter: emit spec-level start/end | LOW | Per-test live progress in Manager timeline |
| 6 | History: search by args substring | LOW | Filter by file/grep/project |
| 7 | TD-03: multi-run parallelism | LOW | Large effort — per-suite registry or process pool |
| 8 | TD-04: scope RESULTS_JSON_PATH per run ID | LOW | Fragile with single-run lock but still a concern |
| 9 | TD-15: Zod body validation on routes | LOW | Malformed bodies currently get inline checks |
| 10 | Mobile layout audit | LOW | Card grid breakpoints, nav wrapping |
| 11 | a11y: skip-to-content link | LOW | Keyboard navigation |
| 12 | autonomous-run.js: wire real file-read context for engineer agents | MED | Currently passes architecture.md only; should pass actual file contents |
| 13 | autonomous-run.js: add retry loop on QA rejection | LOW | Re-send QA issues to engineer for a second attempt |

## Known Broken / Needs Watch
- Mock step stubs use inferred Playwright actions — may need tuning for unusual step phrasings
- `History.tsx` stat cards use `animate-count-up` CSS class — entrance animation only
- QA-12: `needsBaseline()` removed; no outstanding snapshot issues
- autonomous-run.js requires GEMINI_API_KEY in CI secrets to activate
