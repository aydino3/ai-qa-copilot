# Tech Debt

_Last updated: 2026-05-15_

## Resolved

| ID | Item | Fix | Commit |
|----|------|-----|--------|
| TD-01 | In-memory history lost on restart | `persistRecord()` + `loadHistory()` in runRegistry; `test-results/runs.jsonl` | 019af9b |
| TD-02 | FRAMEWORK_ROOT hardcoded | Removed Mac path; env var or path.resolve() relative to src | 019af9b |
| TD-05 | `_patchedCount` module-level mutable | Refactored to local `counts` object | 019af9b |
| TD-06 | Evidence re-parsed every request | Cached in `record._evidenceCache` after terminal status | 019af9b |
| TD-07 | config.ts TS2881 dead code | Removed with TD-02 | 019af9b |
| TD-08 | Mock step body `// TODO: implement` | `inferStepBody()` infers fill/click/navigate/assert stubs | 4331ffc |
| TD-09 | `maxDiffPixelRatio: 0.15` too permissive | Lowered to 0.03 | 019af9b |
| TD-11 | WS replays full log history on reconnect | `?after=<ts>` cursor on WS upgrade; `lastTsRef` in hook | 4331ffc |
| TD-12 | No error boundary around RunReport | `<ErrorBoundary>` wrapper in RunDetails | 019af9b |
| TD-13 | Asset route no explicit MIME types | `mimeMap` before `res.sendFile` | 019af9b |
| TD-16 | AI-generated tests committed to VCS | `tests/ai-generated/*.ts` in .gitignore | 019af9b |
| TD-17 | Donut rAF timing | Double rAF in `useLayoutEffect` | e1e5ea6 |

## Remaining

| ID | Item | Location | Impact | Effort |
|----|------|----------|--------|--------|
| TD-03 | Single active run lock is global | `runRegistry.hasActive()` | Can't parallelize test suites | L |
| TD-04 | `RESULTS_JSON_PATH` shared across runs | `config.ts` | Would corrupt on concurrent runs (mitigated by lock) | M |
| TD-10 | History: no full virtual scroll | `History.tsx` | Now has pagination; virtual scroll still better for huge sets | M |
| TD-14 | `Date.now()` everywhere | Multiple files | Timezone-naive relative times | S |
| TD-15 | No Zod body validation | All routes | Inline checks exist; not Zod-grade | M |
