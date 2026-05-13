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
  res.json(buildEvidence(record));
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

/** Convert an absolute filesystem path to a URL served by the static middleware. */
function toUrl(absPath: string | undefined): string | undefined {
  if (!absPath) return undefined;
  const rel = absPath.startsWith(FRAMEWORK_ROOT)
    ? absPath.slice(FRAMEWORK_ROOT.length)
    : absPath;
  return rel.startsWith('/') ? rel : `/${rel}`;
}

function processStep(s: PWStep): EvidenceStep {
  return {
    title: s.title,
    duration: s.duration,
    category: s.category,
    status: s.error ? 'failed' : 'passed',
    error: s.error?.message,
    steps: (s.steps ?? []).map(processStep),
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

  if (!report?.suites) {
    return { runId: record.id, baselineRun, tests: [] };
  }

  const flat = flattenSuites(report.suites);
  const tests: TestEvidence[] = flat.map(({ specTitle, test, result }) => {
    const screenshots: string[] = [];
    const named = new Map<string, string>();

    for (const att of result.attachments ?? []) {
      const url = toUrl(att.path);
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
      status: result.status,
      ok: test.ok,
      duration: result.duration,
      retry: result.retry,
      steps: (result.steps ?? []).map(processStep),
      screenshots,
      video: named.get('video'),
      trace: named.get('trace'),
      baseline: named.get('expected'),
      actual: named.get('actual'),
      diff: named.get('diff'),
      errors: (result.errors ?? []).map((e) => e.message),
    };
  });

  return { runId: record.id, baselineRun, tests };
}
