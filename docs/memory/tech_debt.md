# Tech Debt

_Last updated: 2026-05-14_

## Critical (blocks reliability)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-01 | In-memory run history lost on restart | `runRegistry.ts` | History page empties after any deploy or crash | M — write runs to `test-results/runs.jsonl` on finalize |
| TD-02 | `FRAMEWORK_ROOT` hardcoded as fallback | `config.ts:12` | Works only on Aydin's Mac; any other machine needs `FRAMEWORK_ROOT` env var set manually | XS — remove hardcoded path, document env var requirement |
| TD-03 | Single active run lock is global | `runRegistry.hasActive()` | Can't run two isolated test suites simultaneously | L — would require per-suite registry or process pool |

## High (degrades quality)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-04 | `RESULTS_JSON_PATH` is a single shared file | `config.ts` | Concurrent run attempts would corrupt results.json (mitigated by single-run lock but fragile) | M — scope to run ID |
| TD-05 | `_patchedCount` is a module-level mutable | `spawnRun.ts:203` | Not thread-safe; would be wrong if two runs overlapped | XS — pass as return value from `patchSuites()` |
| TD-06 | Evidence endpoint re-parses report on every request | `routes/runs.ts buildEvidence()` | Fine at current scale; wasted CPU if called frequently | S — cache parsed evidence on `record` after first build |
| TD-07 | `config.ts` TS2881 lint error | `config.ts:12` | Suppressed but adds noise; the `?? '/Users/...'` is unreachable since first operand is never nullish | XS — remove the dead fallback or restructure |

## Medium (code smell)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-08 | `generateTest.ts` mock step body is `// TODO: implement` | `generateTest.ts:202` | Generated tests don't run without user editing each step | M — generate realistic Playwright action stubs from step text |
| TD-09 | `toHaveScreenshot` `maxDiffPixelRatio: 0.15` is very permissive | `playwright.config.ts` | 15% pixel diff allowed before failure; may mask real regressions | XS — lower to 0.03–0.05 with operator override |
| TD-10 | History page doesn't support pagination | `History.tsx` | Long sessions produce one very long list | M — virtual scroll or "load more" |
| TD-11 | `useRunStream` replays full log history on every WS reconnect | `logSocket.ts:80-91` | Large logs cause slow reconnect and high initial payload | M — add cursor/offset param to WS URL |
| TD-12 | No error boundary around Evidence Modal | `RunDetails.tsx` | An unhandled error in `EvidenceModal` crashes the whole RunDetails page | S — add React error boundary wrapper |
| TD-13 | Asset route does no MIME-type sniffing | `routes/runs.ts` `:id/asset` | `res.sendFile` guesses from extension; unusual extensions may serve wrong Content-Type | XS — pass explicit `headers` map for known types |

## Low (nice-to-fix)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-14 | `Date.now()` used as timestamp everywhere | Multiple files | Timezone-naive; relative time in History may be wrong in non-local deploys | S — standardise to ISO strings |
| TD-15 | No request body validation (Zod / ajv) | All routes | Malformed bodies produce cryptic 500s instead of 400s | M — add a lightweight validator |
| TD-16 | `tests/ai-generated/.gitkeep` but generated tests are committed | `.gitignore` | AI-generated tests accumulate in source control | XS — add `tests/ai-generated/*.ts` to `.gitignore` |
| TD-17 | `Donut.tsx` uses `requestAnimationFrame` to trigger CSS transition | `Donut.tsx:30` | rAF fires before paint; may not always trigger the CSS transition on first render | S — use `useLayoutEffect` + double rAF |
