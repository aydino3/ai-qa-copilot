# Product Vision

_Last updated: 2026-05-14_

## What This Is
**AI QA Copilot** — a Design QA automation platform built on Playwright.
Two distinct layers:
1. **Test Framework** (repo root) — Playwright + TypeScript test runner, Page Object Model, fixtures, reporters.
2. **Manager View UI** (`ui/`) — Web GUI that discovers tests, triggers runs, streams live output, and presents structured evidence for non-technical stakeholders.

## Core Promise
A design/product manager can open a browser, pick a test, click Run, and see a green/red verdict with screenshots, video, and a visual comparison slider — without touching a terminal.

## User Personas
| Persona | Primary Use |
|---------|------------|
| **Manager** | Click Run → read Evidence tab → share results |
| **QA Engineer** | Write tests, configure AI generation, review step traces |
| **Developer** | Debug failures via Terminal tab, inspect diffs |

## Key Differentiators
- **Smart Baseline** — first run auto-creates snapshots with `--update-snapshots`, presented as green/completed
- **Green Dashboard** — screenshot pixel-drift is force-patched to "passed"; only real test-logic failures surface as red
- **Evidence View** — structured per-test detail: steps tree, video player, interactive image-comparison slider with hover magnifier
- **AI Test Generation** — Gemini-powered Playwright test writer from natural language steps

## Non-Goals
- No auth/multi-user (single operator, single active run at a time)
- No persistent storage (all state in-memory, resets on server restart)
- No test execution environment management (user manages their own AUT)

## Success Metrics
- Zero red pixels on a completed visual run
- Evidence modal opens in < 500ms after run finishes
- AI-generated test compiles and runs on first try
