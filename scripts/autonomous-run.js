#!/usr/bin/env node
'use strict';

/**
 * Autonomous agent pipeline for ai-qa-copilot.
 *
 * Pipeline:
 *   1. Architect  — audits codebase, identifies violations and improvements.
 *   2. Engineer   — receives Architect's plan, emits a JSON array of file patches.
 *   3. Applier    — writes patches to disk.
 *
 * Usage:
 *   node scripts/autonomous-run.js
 *
 * Required env:
 *   GEMINI_API_KEY — Gemini API key (loaded from .env if present)
 */

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('node:fs');
const path = require('node:path');

// ─── Config ──────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const MODEL_ID = 'gemini-2.5-flash';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('[autonomous-run] GEMINI_API_KEY is not set. Add it to .env or your environment.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// ─── Codebase snapshot ────────────────────────────────────────────────────────

/**
 * Reads a file relative to REPO_ROOT, returns its content or an error note.
 */
function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  } catch {
    return `(file not found: ${relPath})`;
  }
}

/**
 * Builds a condensed snapshot of key files to feed to the agents.
 */
function buildCodebaseSnapshot() {
  const files = [
    'playwright.config.ts',
    'src/ai/failure-analyzer.ts',
    'src/reporters/ai-enhanced.reporter.ts',
    'src/utils/env.ts',
    'src/utils/retry.ts',
    'src/utils/api.client.ts',
    'src/fixtures/auth.fixture.ts',
    'src/fixtures/data.fixture.ts',
    'src/fixtures/index.ts',
    'src/pages/base.page.ts',
    'src/pages/login.page.ts',
    'src/pages/dashboard.page.ts',
    'ui/server/src/runner/runRegistry.ts',
    'ui/server/src/runner/spawnRun.ts',
    'ui/server/src/routes/runs.ts',
    'ui/server/src/routes/generateTest.ts',
    'test-data/factories/base.factory.ts',
    'docs/memory/architecture.md',
    'docs/memory/active_tasks.md',
    'docs/memory/tech_debt.md',
  ];

  return files
    .map((f) => `### ${f}\n\`\`\`\n${readFile(f)}\n\`\`\``)
    .join('\n\n');
}

// ─── Agent: Architect ─────────────────────────────────────────────────────────

const ARCHITECT_SYSTEM = `You are a senior software architect reviewing an AI-powered QA automation framework built on Playwright + TypeScript.

Your job is to audit the codebase snapshot provided and produce a concrete improvement plan.

Architectural rules you enforce:
- RunRegistry is the single source of truth for run state (no parallel mutable state).
- No shared mutable module-level variables across requests.
- Tests never reference raw selectors — all selectors live in Page Object classes.
- AI features are strictly opt-in (guarded by AI_ENABLED env var).
- All environment variables are validated at startup via requireEnv().

EXCEPTION: Markdown files (.md) in docs/memory/ are just documentation and are strictly EXEMPT from the 'RunRegistry is the single source of truth' and 'No shared mutable state' rules. Do not flag them as violations.

Output format:
Return a clear, numbered action plan. For each item state:
  - Which file(s) to change
  - What to change and why
  - Acceptance criteria

Be specific and actionable. Do not write code — that is the Engineer's job.`;

async function runArchitect(snapshot) {
  console.log('[Architect] Auditing codebase…');

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: ARCHITECT_SYSTEM,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
  });

  const prompt = `Here is the current codebase snapshot:\n\n${snapshot}\n\nProduce your improvement plan now.`;
  const result = await model.generateContent(prompt);
  const plan = result.response.text();

  if (!plan) throw new Error('Architect returned an empty plan.');
  console.log('[Architect] Plan received.\n');
  console.log('─'.repeat(60));
  console.log(plan);
  console.log('─'.repeat(60) + '\n');
  return plan;
}

// ─── Agent: Engineer ──────────────────────────────────────────────────────────

const ENGINEER_SYSTEM = `You are a senior software engineer implementing a code improvement plan for an AI-powered QA automation framework.

You will receive:
1. A codebase snapshot (key files with their current contents).
2. An Architect's improvement plan.

Your task:
Implement every item in the plan. Output ONLY a JSON array where each element is a file patch:

[
  {
    "file": "relative/path/from/repo/root.ts",
    "content": "<complete new file content as a string>"
  }
]

Rules:
- Output the JSON array and nothing else — no markdown fences, no explanation before or after.
- Each "content" value is the COMPLETE file content (not a diff).
- Only include files that actually need to change.
- Preserve all existing behaviour unless the plan explicitly changes it.
- Do not modify docs/memory/*.md files — they are documentation only.
- The first character of your response MUST be '['.`;

async function runEngineer(snapshot, plan) {
  console.log('[Engineer] Implementing plan…');

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: ENGINEER_SYSTEM,
    // Fix #1: raise token limit so large JSON responses are never truncated.
    generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
  });

  const prompt = `## Codebase snapshot\n\n${snapshot}\n\n## Architect's plan\n\n${plan}\n\nImplement all changes now. Output the JSON patch array only.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  if (!text) throw new Error('Engineer returned an empty response.');

  // Fix #2: use regex to extract the JSON array before parsing,
  // guarding against any stray preamble the model might emit.
  const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const jsonStr = match ? match[0] : text;

  // Fix #3: safe JSON parse — log and return empty array instead of crashing.
  let patches;
  try {
    patches = JSON.parse(jsonStr);
  } catch (err) {
    console.error('[Engineer] Parse failed:', err.message);
    console.error('[Engineer] Raw response (first 500 chars):', text.slice(0, 500));
    return [];
  }

  if (!Array.isArray(patches)) {
    console.error('[Engineer] Expected a JSON array but got:', typeof patches);
    return [];
  }

  console.log(`[Engineer] ${patches.length} file patch(es) received.\n`);
  return patches;
}

// ─── Applier ──────────────────────────────────────────────────────────────────

function applyPatches(patches) {
  if (patches.length === 0) {
    console.log('[Applier] No patches to apply.');
    return;
  }

  for (const patch of patches) {
    if (!patch.file || typeof patch.content !== 'string') {
      console.warn('[Applier] Skipping malformed patch entry:', JSON.stringify(patch).slice(0, 120));
      continue;
    }

    // Safety: never let the model write outside the repo root.
    const absPath = path.resolve(REPO_ROOT, patch.file);
    if (!absPath.startsWith(REPO_ROOT + path.sep) && absPath !== REPO_ROOT) {
      console.warn('[Applier] Blocked path traversal attempt:', patch.file);
      continue;
    }

    // Never overwrite docs/memory markdown files — they are documentation only.
    if (/^docs[/\\]memory[/\\].*\.md$/i.test(patch.file)) {
      console.warn('[Applier] Skipping docs/memory file (exempt from patches):', patch.file);
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, patch.content, 'utf8');
      console.log('[Applier] Written:', patch.file);
    } catch (err) {
      console.error('[Applier] Failed to write', patch.file, '—', err.message);
    }
  }

  console.log('\n[Applier] Done.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[autonomous-run] Starting pipeline…\n');

  const snapshot = buildCodebaseSnapshot();

  const plan = await runArchitect(snapshot);
  const patches = await runEngineer(snapshot, plan);
  applyPatches(patches);

  console.log('\n[autonomous-run] Pipeline complete.');
}

main().catch((err) => {
  console.error('[autonomous-run] Fatal error:', err);
  process.exit(1);
});
