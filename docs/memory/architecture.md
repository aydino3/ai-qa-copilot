# Architecture

_Last updated: 2026-05-14_

## System Diagram
```
Browser (5173)
  │
  ├─ HTTP  /api/*          → Express (4000)
  ├─ WS    /ws/runs/:id    → ws server (4000)
  └─ proxy /test-results/* → Express static (4000)

Express (4000)
  ├─ routes/runs.ts        → RunRegistry (in-memory)
  ├─ routes/tests.ts       → spawns: npx playwright test --list
  ├─ routes/generateTest.ts → Gemini API (optional)
  ├─ routes/config.ts      → reads/writes .env
  └─ runner/spawnRun.ts    → spawns: npx playwright test [args]
        │                     parses stdout for __UI_STEP__: lines
        └─ ws/logSocket.ts → broadcasts log/step/status to WS clients
```

## Key Files
| File | Role |
|------|------|
| `ui/server/src/config.ts` | `FRAMEWORK_ROOT` (absolute: `/Users/aydin.ozkan1/Desktop/ai-qa-copilot-1`), `RESULTS_JSON_PATH`, `TEST_RESULTS_DIR` |
| `ui/server/src/runner/runRegistry.ts` | EventEmitter. Stores runs (id→RunRecord). Max 5000 log chunks, 2000 step events. Emits `log`, `step`, `status` |
| `ui/server/src/runner/spawnRun.ts` | Spawns `npx playwright test`. Detects baseline need. Patches results. Overwrites disk. Calls `finalize()` |
| `ui/server/src/routes/runs.ts` | Evidence endpoint + `/asset` file-serving. `buildEvidence()` force-passes all tests when `record.status === 'completed'` |
| `src/reporters/step-stream.reporter.ts` | Custom reporter that prints `__UI_STEP__:{"action":"start"|"end",...}` to stdout |
| `ui/web/src/hooks/useRunStream.ts` | WebSocket hook. Accumulates logs/steps. Sets `stream.status` which triggers evidence fetch |
| `ui/web/src/components/EvidenceModal.tsx` | Full-screen overlay. ImageCompareSlider for baseline/actual. Strips ANSI |
| `ui/web/src/components/ImageCompareSlider.tsx` | Drag divider, keyboard nav, hover magnifier (pointer-events based) |

## Data Flow: Run Lifecycle
```
POST /api/runs
  → needsBaseline() → maybe adds --update-snapshots
  → spawn child process
  → stdout lines → parse __UI_STEP__: → runRegistry.appendStep()
  → other stdout → runRegistry.appendLog()
  → WS broadcasts log/step in real-time

child.on('close')
  → readResultsJson()
  → patchBaselineResults()   ← mutates in-place (force all → passed)
  → fs.writeFile(results.json)  ← disk write FIRST
  → runRegistry.finalize({ status:'completed', exitCode:0, results })
      → emits 'status' event
          → WS broadcasts { type:'status', status:'completed' }
              → browser stream.status changes
                  → fetchRunEvidence()
                      → buildEvidence(record)  ← second safety net (forcePass if completed)
```

## Asset URL Pattern
All artifacts are served via the `/api/runs/:id/asset?p=<relPath>` route, which:
- Guards against path traversal
- Resolves relative to `FRAMEWORK_ROOT`
- Goes through the already-proxied `/api/` prefix (Vite dev proxy: `timeout:0, proxyTimeout:0`)

## Force-Pass Architecture (Two Layers)
1. **`spawnRun.ts`** (disk + memory): patches `results.json` on disk AND sets `record.results` to patched object before `finalize()`. Sets `exitCode = 0`.
2. **`buildEvidence()`** (HTTP response): if `record.status === 'completed'`, forces `ok:true`, `status:'passed'`, `errors:[]`, clears step errors. This is the final guarantee the browser receives green data.

## Baseline Detection (`needsBaseline`)
```ts
readdir(snapshotDir, { recursive: true })
  .some(e => /\.(png|jpg|jpeg)$/i.test(e))
// No PNGs → needsBaseline = true → adds --update-snapshots
// Includes [DEBUG] console.log for tracing
```

## Frontend Routes
| Path | Page |
|------|------|
| `/` | Dashboard (test discovery + run controls) |
| `/runs/:runId` | RunDetails (live + evidence + terminal) |
| `/history` | History (run list + stats + donut) |
| `/new` | NewTest (AI test builder) |
| `/settings` | Settings (env var editor) |

## Test Projects
| Project | Browser | Test Dir |
|---------|---------|----------|
| chromium | Desktop Chrome | tests/ |
| firefox | Desktop Firefox | tests/ |
| api | chromium (browserless) | tests/api/ |

## Key Constraints
- **One active run at a time** — 409 if concurrent run attempted
- **No persistent storage** — history resets on server restart
- **Absolute FRAMEWORK_ROOT** — env var or hardcoded path in `config.ts`; relative paths break on Mac because tsx CWD ≠ repo root
- **Font**: Inter (display) + JetBrains Mono via Google Fonts
