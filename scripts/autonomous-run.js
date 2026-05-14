#!/usr/bin/env node
/**
 * Autonomous Engineering Runner
 *
 * Orchestrates a multi-agent session:
 *   1. Product Owner reads memory → prioritized work order
 *   2. Architect reviews recent diffs → flags violations
 *   3. Backend / Frontend engineers implement top work item
 *   4. QA Engineer reviews proposed changes
 *   5. If approved: write files, typecheck, build, commit, push
 *   6. Memory Scribe updates all memory files
 *
 * Usage:
 *   node scripts/autonomous-run.js [--dry-run] [--item <task-id>]
 *
 * Required env vars:
 *   GEMINI_API_KEY   — Gemini API key (gemini-2.5-flash)
 *   GITHUB_TOKEN     — For git push in CI (set by Actions)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { ROLES } from './agents/roles.js';

const ROOT = resolve(import.meta.dirname, '..');
const MEMORY = join(ROOT, 'docs', 'memory');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCED_ITEM = (() => {
  const idx = process.argv.indexOf('--item');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readMemory(name) {
  try { return readFileSync(join(MEMORY, name), 'utf8'); }
  catch { return '(not found)'; }
}

function writeMemory(name, content) {
  writeFileSync(join(MEMORY, name), content, 'utf8');
}

function git(cmd) {
  return execSync(`git -C ${ROOT} ${cmd}`, { encoding: 'utf8' }).trim();
}

async function callGemini(systemPrompt, userMessage, temperature = 0.2) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 8192, temperature },
  });
  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

function parseJson(text, fallback) {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? [null, text];
    return JSON.parse(match[1]);
  } catch {
    console.error('[autonomous-run] JSON parse failed:', text.slice(0, 200));
    return fallback;
  }
}

// ─── Main orchestration ───────────────────────────────────────────────────────

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[autonomous-run] GEMINI_API_KEY is required');
    process.exit(1);
  }

  console.log('[autonomous-run] Starting autonomous session…');

  // Load memory
  const ctx = {
    activeTasks:   readMemory('active_tasks.md'),
    techDebt:      readMemory('tech_debt.md'),
    qaFindings:    readMemory('qa_findings.md'),
    sessionLog:    readMemory('session_log.md'),
    architecture:  readMemory('architecture.md'),
  };

  // ── Step 1: Product Owner → work order ───────────────────────────────────
  console.log('[1/6] Product Owner: prioritizing work order…');
  const poResponse = await callGemini(
    ROLES.productOwner(ctx),
    'Produce the prioritized work order for this session.',
  );
  const workOrder = parseJson(poResponse, []);
  if (workOrder.length === 0) {
    console.log('[autonomous-run] No work items found. Exiting.');
    return;
  }

  const workItem = FORCED_ITEM
    ? workOrder.find((w) => w.id === FORCED_ITEM) ?? workOrder[0]
    : workOrder[0];

  console.log(`[autonomous-run] Top work item: [${workItem.id}] ${workItem.title}`);

  // ── Step 2: Architect review ──────────────────────────────────────────────
  console.log('[2/6] Architect: reviewing recent changes…');
  ctx.changedFiles = (() => {
    try { return git('diff HEAD~1 --name-only'); }
    catch { return '(no previous commit)'; }
  })();

  const archResponse = await callGemini(
    ROLES.architect(ctx),
    `Review changed files for architectural violations:\n${ctx.changedFiles}`,
  );
  const archFindings = parseJson(archResponse, []);
  const archErrors = archFindings.filter((f) => f.violation);
  if (archErrors.length > 0) {
    console.warn('[autonomous-run] Architectural violations detected:');
    archErrors.forEach((f) => console.warn(`  ${f.file}: ${f.violation}`));
  }

  // ── Step 3: Determine engineer role and implement ─────────────────────────
  console.log('[3/6] Engineer: implementing work item…');

  // Determine if backend or frontend based on task title keywords
  const isBackend = /server|api|route|registry|spawn|ws|backend/i.test(workItem.title);
  const rolePrompt = isBackend
    ? ROLES.backendEngineer({ workItem: `[${workItem.id}] ${workItem.title}\n\nRationale: ${workItem.rationale}`, fileContents: ctx.architecture })
    : ROLES.frontendEngineer({ workItem: `[${workItem.id}] ${workItem.title}\n\nRationale: ${workItem.rationale}`, fileContents: ctx.architecture });

  const engineerResponse = await callGemini(
    rolePrompt,
    `Implement this work item. Return modified files as JSON array.`,
    0.3,
  );
  const proposedFiles = parseJson(engineerResponse, []);

  if (proposedFiles.length === 0) {
    console.log('[autonomous-run] Engineer produced no file changes. Exiting.');
    return;
  }

  // ── Step 4: QA review ────────────────────────────────────────────────────
  console.log('[4/6] QA Engineer: reviewing proposed changes…');
  ctx.proposedChanges = proposedFiles
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join('\n\n');

  const qaResponse = await callGemini(
    ROLES.qaEngineer(ctx),
    'Review proposed changes.',
  );
  const qaResult = parseJson(qaResponse, { approved: false, issues: [] });

  const qaErrors = (qaResult.issues ?? []).filter((i) => i.severity === 'error');
  if (!qaResult.approved || qaErrors.length > 0) {
    console.warn('[autonomous-run] QA review failed:');
    qaErrors.forEach((i) => console.warn(`  [${i.severity}] ${i.file}: ${i.issue}`));
    console.log('[autonomous-run] Aborting — not writing files.');
    return;
  }

  console.log('[autonomous-run] QA approved.');

  // ── Step 5: Write files, typecheck, build, commit, push ──────────────────
  if (DRY_RUN) {
    console.log('[autonomous-run] DRY RUN — skipping file writes and git ops.');
    proposedFiles.forEach((f) => console.log(`  Would write: ${f.path}`));
  } else {
    console.log('[5/6] Writing files and committing…');
    for (const { path: filePath, content } of proposedFiles) {
      const abs = resolve(ROOT, filePath);
      mkdirSync(resolve(abs, '..'), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      console.log(`  Wrote: ${filePath}`);
    }

    // Typecheck + build before committing
    try {
      execSync('npm run typecheck:ui && npm run build:ui && npm run typecheck', {
        cwd: ROOT, stdio: 'inherit',
      });
    } catch {
      console.error('[autonomous-run] Typecheck/build failed — reverting changes.');
      git('checkout -- .');
      return;
    }

    // Commit
    const branch = git('rev-parse --abbrev-ref HEAD');
    const msg = `[${workItem.id}] ${workItem.title} (autonomous)`;
    git(`add ${proposedFiles.map((f) => f.path).join(' ')}`);
    git(`commit -m "${msg.replace(/"/g, '\\"')}"`);
    git(`push -u origin ${branch}`);
    console.log(`[autonomous-run] Committed and pushed to ${branch}`);
  }

  // ── Step 6: Memory Scribe ─────────────────────────────────────────────────
  console.log('[6/6] Memory Scribe: updating memory files…');
  ctx.completedWork = `[${workItem.id}] ${workItem.title}`;

  const scribeResponse = await callGemini(
    ROLES.memoryScribe(ctx),
    'Update the memory files to reflect this session.',
  );
  const memoryUpdates = parseJson(scribeResponse, {});

  if (!DRY_RUN) {
    for (const [name, content] of Object.entries(memoryUpdates)) {
      if (typeof content === 'string' && content.length > 0) {
        writeMemory(name, content);
        console.log(`  Updated: docs/memory/${name}`);
      }
    }
  }

  console.log('[autonomous-run] Session complete.');
}

run().catch((err) => {
  console.error('[autonomous-run] Fatal error:', err);
  process.exit(1);
});
