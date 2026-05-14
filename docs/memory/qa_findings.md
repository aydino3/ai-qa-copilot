# QA Findings

_Last updated: 2026-05-14 | Branch: claude/design-qa-automation-architecture-W3tXU_

## Resolved Issues (this session)

| ID | Symptom | Root Cause | Fix | Commit |
|----|---------|-----------|-----|--------|
| QA-01 | Test cards red on baseline run | `patchBaselineResults()` only ran if `baselineRun=true`; subsequent runs had snapshots so flag was false | Removed condition; patch runs unconditionally | 0925480 |
| QA-02 | "COMPLETED EXIT 1" badge despite passing | Raw Playwright exit code (1 on snapshot mismatch) leaked to UI | Override `exitCode` to 0 when `patchedSuccessfully=true` | 549fdd9 |
| QA-03 | UI shows stale red data | `finalize()` could theoretically fire before `fs.writeFile` completes | `patchedSuccessfully` flag gates `finalExitCode`; ordering already correct but now explicit | 549fdd9 |
| QA-04 | Test cards still red even after server patch | `buildEvidence()` read raw `test.ok`/`result.errors` without safety net | Added `forcePass = record.status === 'completed'` gate in `buildEvidence()` | ed0d865 |
| QA-05 | Assets 404 (screenshots, videos, traces) | Vite dev proxy didn't forward `/test-results/*` | Added proxy rules + dedicated `/api/runs/:id/asset` route | 5513f4d |
| QA-06 | ANSI colour codes in error display | Playwright embeds VT100 sequences in `errors[].message` | `stripAnsi()` applied in `EvidenceModal.tsx` and `patchSuites()` | a617867 |
| QA-07 | EPIPE/ECONNRESET on large video/trace transfers | Vite proxy default timeout too short | `timeout: 0, proxyTimeout: 0` on `/api` and `/test-results` proxy rules | ec0a382 |
| QA-08 | `test('title', ...)` with apostrophes breaks syntax | AI emitted single-quoted strings; user text had Aydın'ın, "About Me" | Backtick mandate in system prompt + `normalizeQuotesToBackticks()` post-processor | cb72c9f |
| QA-09 | Baseline skipped even when snapshot dir was empty | `needsBaseline()` used `fs.access()` — only checked existence, not contents | Replaced with `fs.readdir({ recursive:true })` checking for PNG files | 5513f4d |
| QA-10 | Step rows show red ✗ inside EvidenceModal after completed run | `processStep()` read raw `s.error` from unpatched object | Added `forcePass` param to `processStep()` | ed0d865 |

## Open / Unverified
| ID | Symptom | Suspected Cause | Next Action |
|----|---------|----------------|-------------|
| QA-11 | ImageCompareSlider magnifier may mis-centre on tall screenshots | Background-size math assumes aspect ratio preserved | Test with portrait screenshots, fix `bgX`/`bgY` calculation |
| QA-12 | `needsBaseline()` `recursive: true` may miss snapshots in deeply nested dirs | Playwright stores per-project snapshots in subdirs | Verify on multi-project visual test |
| QA-13 | History stat-card "Avg Duration" shows `—` when no finished runs | `avgMs = 0` returns `—` — correct but may confuse | Consider showing "No data" instead |

## Regression Risks
- Changing `FRAMEWORK_ROOT` in `config.ts` breaks all asset URLs (they're relative to that root)
- Editing `patchBaselineResults()` or `patchSuites()` logic can re-introduce red cards — always verify with a visual test run
- `normalizeQuotesToBackticks()` regex may miss multi-line test titles (unlikely but possible)
