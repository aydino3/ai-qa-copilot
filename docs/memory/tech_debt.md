# Tech Debt

_Last updated: 2026-05-14_

## Resolved (this session)

| ID | Item | Fix |
|----|------|-----|
| TD-01 | In-memory run history lost on restart | Persisted to `test-results/runs.jsonl` via `persistRecord()` + `loadHistory()` in `runRegistry.ts` |
| TD-02 | `FRAMEWORK_ROOT` hardcoded fallback | Removed hardcoded Mac path; now env var or `path.resolve()` relative to source |
| TD-05 | `_patchedCount` module-level mutable | Refactored to local `counts` object passed through recursive `patchSuites()` |
| TD-06 | Evidence re-parsed on every request | Cached in `record._evidenceCache` after first build on terminal run |
| TD-07 | `config.ts` TS2881 dead fallback | Removed with TD-02 fix |
| TD-09 | `maxDiffPixelRatio: 0.15` too permissive | Lowered to `0.03` |
| TD-12 | No error boundary around Evidence/RunReport | `ErrorBoundary.tsx` component wrapping `<RunReport>` in `RunDetails.tsx` |
| TD-13 | Asset route no explicit MIME types | Added `mimeMap` for png/jpg/webm/mp4/zip/json before `res.sendFile` |
| TD-16 | AI-generated tests committed to VCS | Added `tests/ai-generated/*.ts` to `.gitignore` |

## Critical (blocks reliability)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-03 | Single active run lock is global | `runRegistry.hasActive()` | Can't run two isolated test suites simultaneously | L — per-suite registry or process pool |

## High (degrades quality)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-04 | `RESULTS_JSON_PATH` is a single shared file | `config.ts` | Concurrent run attempts would corrupt results.json | M — scope to run ID |

## Medium (code smell)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-08 | Mock step body is `// TODO: implement` | `generateTest.ts` | Generated tests don't run without user edit | M — Playwright action stubs from step text |
| TD-11 | WS replays full log history on reconnect | `logSocket.ts:80-91` | High initial payload on reconnect | M — cursor/offset param on WS URL |
| TD-15 | No request body validation | All routes | Malformed bodies give 500 not 400 | M — add Zod |

## Low (nice-to-fix)

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-14 | `Date.now()` everywhere | Multiple files | Timezone-naive relative times | S — ISO strings |
| TD-17 | `Donut.tsx` rAF CSS transition | `Donut.tsx:30` | May not trigger on first render | S — `useLayoutEffect` + double rAF |
