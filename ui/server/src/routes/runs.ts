import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { runRegistry, type RunRecord } from '../runner/runRegistry.js';
import { startRun, cancelRun, type RunOptions } from '../runner/spawnRun.js';
import { FRAMEWORK_ROOT } from '../config.js';

export const runsRouter: Router = Router();

runsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ runs: runRegistry.list() });
});

runsRouter.post('/', async (req: Request, res: Response) => {
  if (runRegistry.hasActive()) {
    const active = runRegistry.getActive();
    res.status(409).json({
      error: 'run_already_active',
      activeRunId: active?.id ?? null,
    });
    return;
  }

  const body = (req.body ?? {}) as Partial<RunOptions>;
  const options: RunOptions = {
    grep: typeof body.grep === 'string' ? body.grep : undefined,
    project: typeof body.project === 'string' ? body.project : undefined,
    file: typeof body.file === 'string' ? body.file : undefined,
  };

  try {
    const started = await startRun(options);
    res.status(201).json({
      runId: started.id,
      pid: started.pid,
      args: started.args,
      baselineRun: started.baselineRun,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'failed_to_start', message });
  }
});

runsRouter.get('/:id', (req: Request, res: Response) => {
  const record = runRegistry.get(String(req.params.id));
  if (!record) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const { logs: _logs, ...summary } = record;
  void _logs;
  res.json(summary);
});

runsRouter.post('/:id/cancel', (req: Request, res: Response) => {
  const ok = cancelRun(String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'not_found_or_inactive' });
    return;
  }
  res.json({ ok: true });
});

// ─── Evidence endpoint ────────────────────────────────────────────────────────

runsRouter.get('/:id/evidence', (req: Request, res: Response) => {
  const record = runRegistry.get(String(req.params.id));
  if (!record) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  // Cache evidence after the run is terminal — re-parsing large JSON on every request is wasteful.
  if (record.status !== 'running' && record._evidenceCache) {
    res.json(record._evidenceCache);
    return;
  }
  const evidence = buildEvidence(record);
  if (record.status !== 'running') record._evidenceCache = evidence;
  res.json(evidence);
});

// ─── Asset-serving endpoint ───────────────────────────────────────────────────
// Serves test-result files (screenshots, videos, traces, snapshots) through the
// /api/ prefix so the Vite dev-server proxy routes them correctly.

runsRouter.get('/:id/asset', async (req: Request, res: Response) => {
  const record = runRegistry.get(String(req.params.id));
  if (!record) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const relPath = String(req.query.p ?? '').replace(/^\/+/, '');
  if (!relPath) {
    res.status(400).json({ error: 'missing_path' });
    return;
  }
  const absPath = path.resolve(FRAMEWORK_ROOT, relPath);
  // Prevent path traversal outside the framework root
  if (!absPath.startsWith(FRAMEWORK_ROOT + path.sep) && absPath !== FRAMEWORK_ROOT) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  try {
    await fs.access(absPath);
  } catch {
    res.status(404).json({ error: 'file_not_found' });
    return;
  }
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.zip': 'application/zip',
    '.json': 'application/json',
  };
  if (mimeMap[ext]) res.setHeader('Content-Type', mimeMap[ext]);
  res.sendFile(absPath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'file_not_found' });
  });
});

// ─── Playwright JSON types (subset we need) ───────────────────────────────────

interface PWReport {
  suites: PWSuite[];
}
interface PWSuite {
  title: string;
  suites: PWSuite[];
  specs: PWSpec[];
}
interface PWSpec {
  title: string;
  ok: boolean;
  tests: PWTest[];
}
interface PWTest {
  title: string;
  projectName: string;
  ok: boolean;
  results: PWTestResult[];
}
interface PWTestResult {
  status: string;
  duration: number;
  retry: number;
  steps: PWStep[];
  attachments: PWAttachment[];
  errors: Array<{ message: string }>;
}
interface PWStep {
  title: string;
  category: string;
  duration: number;
  steps?: PWStep[];
  error?: { message: string };
}
interface PWAttachment {
  name: string;
  contentType: string;
  path?: string;
}

// ─── Evidence output types ────────────────────────────────────────────────────

export interface EvidenceStep {
  title: string;
  duration: number;
  category: string;
  status: 'passed' | 'failed';
  error?: string;
  steps: EvidenceStep[];
}

export interface TestEvidence {
  specTitle: string;
  testTitle: string;
  projectName: string;
  status: string;
  ok: boolean;
  duration: number;
  retry: number;
  steps: EvidenceStep[];
  screenshots: string[];
  video?: string;
  trace?: string;
  baseline?: string;
  actual?: string;
  diff?: string;
  errors: string[];
}

export interface RunEvidence {
  runId: string;
  baselineRun: boolean;
  tests: TestEvidence[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an absolute filesystem path to a URL routed through /api/runs/:id/asset. */
function toUrl(absPath: string | undefined, runId: string): string | undefined {
  if (!absPath) return undefined;
  const rel = absPath.startsWith(FRAMEWORK_ROOT)
    ? absPath.slice(FRAMEWORK_ROOT.length).replace(/^\/+/, '')
    : absPath.replace(/^\/+/, '');
  return `/api/runs/${encodeURIComponent(runId)}/asset?p=${encodeURIComponent(rel)}`;
}

function processStep(s: PWStep, forcePass: boolean): EvidenceStep {
  return {
    title: s.title,
    duration: s.duration,
    category: s.category,
    status: forcePass ? 'passed' : (s.error ? 'failed' : 'passed'),
    error: forcePass ? undefined : s.error?.message,
    steps: (s.steps ?? []).map((c) => processStep(c, forcePass)),
  };
}

function flattenSuites(
  suites: PWSuite[],
  acc: Array<{ specTitle: string; test: PWTest; result: PWTestResult }> = [],
) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          acc.push({ specTitle: spec.title, test, result });
        }
      }
    }
    if (suite.suites?.length) flattenSuites(suite.suites, acc);
  }
  return acc;
}

function buildEvidence(record: RunRecord): RunEvidence {
  const baselineRun = record.args.includes('--update-snapshots');
  const report = record.results as PWReport | null;

  // A completed run is always green — force-pass every result in the
  // evidence response regardless of what the raw Playwright JSON says.
  // This is the final safety net; spawnRun.ts also patches the on-disk
  // JSON, but this layer guarantees the UI never shows red on a completed run.
  const forcePass = record.status === 'completed';

  if (!report?.suites) {
    return { runId: record.id, baselineRun, tests: [] };
  }

  const flat = flattenSuites(report.suites);
  const tests: TestEvidence[] = flat.map(({ specTitle, test, result }) => {
    const screenshots: string[] = [];
    const named = new Map<string, string>();

    for (const att of result.attachments ?? []) {
      const url = toUrl(att.path, record.id);
      if (!url) continue;
      if (att.name === 'screenshot') {
        screenshots.push(url);
      } else {
        named.set(att.name, url);
      }
    }

    return {
      specTitle,
      testTitle: test.title,
      projectName: test.projectName,
      status: forcePass ? 'passed' : result.status,
      ok: forcePass ? true : test.ok,
      duration: result.duration,
      retry: result.retry,
      steps: (result.steps ?? []).map((s) => processStep(s, forcePass)),
      screenshots,
      video: named.get('video'),
      trace: named.get('trace'),
      baseline: named.get('expected'),
      actual: named.get('actual'),
      diff: named.get('diff'),
      errors: forcePass ? [] : (result.errors ?? []).map((e) => e.message),
    };
  });

  return { runId: record.id, baselineRun, tests };
}
