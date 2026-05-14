# Active Tasks

_Last updated: 2026-05-14_

## Status Key
`🔴 BLOCKED` `🟡 IN PROGRESS` `🟢 DONE` `⚪ QUEUED`

---

## Resolved This Session

| Commit | Work |
|--------|------|
| 019af9b | TD-01/02/05/06/07/09/12/13/16: XS tech debt sweep; disk history; last-run badge; nav badge; history pagination |
| e1e5ea6 | CLAUDE.md; ui_ux_direction.md; API payload hardening (strip steps/results/_evidenceCache from GET /runs/:id and list); remove debug console.log; per-card "Run file" button; Donut rAF fix |
| 4331ffc | TD-08: infer Playwright stubs from NL step text; TD-11: WS ?after= cursor; per-card file run |
| 9f9d5f2 | RunDetails: context-aware ← Back button |

---

## Remaining Backlog

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 1 | RunDetails: auto-refresh evidence after re-run (no page reload) | MED | Requires polling or WS event trigger |
| 2 | Dashboard: run filter by tag directly from test card chip | MED | Click @smoke → filter + run |
| 3 | CI guide / GitHub Actions example | MED | Users need CI docs |
| 4 | Settings: validate BASE_URL is reachable before run | LOW | Better first-run DX |
| 5 | Step-stream reporter: emit spec-level start/end | LOW | Per-test live progress in Manager timeline |
| 6 | History: search by args substring | LOW | Filter by file/grep/project |
| 7 | TD-03: multi-run parallelism | LOW | Large effort — per-suite registry or process pool |
| 8 | TD-04: scope RESULTS_JSON_PATH per run ID | LOW | Fragile with single-run lock but still a concern |
| 9 | TD-15: Zod body validation on routes | LOW | Malformed bodies currently get inline checks; upgrade if needed |
| 10 | Mobile layout audit | LOW | Card grid breakpoints, nav wrapping |
| 11 | a11y: skip-to-content link | LOW | Keyboard navigation |

## Known Broken / Needs Watch
- Mock step stubs now use inferred Playwright actions — may need tuning for unusual step phrasings
- `History.tsx` stat cards use `animate-count-up` CSS class — entrance animation only, numbers don't count up
- QA-11: ImageCompareSlider magnifier may mis-centre on tall screenshots
- QA-12: `needsBaseline()` may miss deeply-nested snapshot dirs
