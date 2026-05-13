export interface DiscoveredTest {
  title: string;
  file: string;
  line: number;
  column: number;
  projectName: string;
  tags: string[];
}

export interface TestsResponse {
  count: number;
  tests: DiscoveredTest[];
  errors: { message: string; file?: string; line?: number }[];
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'error';

export interface RunSummary {
  id: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  args: string[];
  results: unknown | null;
  errorMessage: string | null;
}

export interface RunOptions {
  grep?: string;
  project?: string;
  file?: string;
}

export interface StartedRun {
  runId: string;
  pid: number | null;
  args: string[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `${res.status} ${res.statusText}`;
    const err = new Error(message) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export async function fetchTests(): Promise<TestsResponse> {
  return jsonOrThrow<TestsResponse>(await fetch('/api/tests'));
}

export async function deleteTest(file: string): Promise<{ ok: true; file: string; fileRemoved: boolean; snapshotsRemoved: boolean }> {
  return jsonOrThrow(
    await fetch(`/api/tests?file=${encodeURIComponent(file)}`, { method: 'DELETE' }),
  );
}

export async function renameTest(
  file: string,
  newName: string,
): Promise<{ ok: true; file: string; previous?: string; unchanged?: boolean; snapshotsRenamed?: boolean }> {
  return jsonOrThrow(
    await fetch('/api/tests', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file, newName }),
    }),
  );
}

export async function startRun(options: RunOptions): Promise<StartedRun> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  });
  return jsonOrThrow<StartedRun>(res);
}

export async function fetchRun(runId: string): Promise<RunSummary> {
  return jsonOrThrow<RunSummary>(await fetch(`/api/runs/${encodeURIComponent(runId)}`));
}

export async function fetchRuns(): Promise<{ runs: RunSummary[] }> {
  return jsonOrThrow<{ runs: RunSummary[] }>(await fetch('/api/runs'));
}

export async function cancelRun(runId: string): Promise<void> {
  await jsonOrThrow<{ ok: true }>(
    await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
  );
}

export interface ConfigResponse {
  vars: Record<string, string>;
  envPath: string;
}

export async function fetchConfig(): Promise<ConfigResponse> {
  return jsonOrThrow<ConfigResponse>(await fetch('/api/config'));
}

export async function saveConfig(vars: Record<string, string>): Promise<{ ok: true; updated: string[] }> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vars),
  });
  return jsonOrThrow<{ ok: true; updated: string[] }>(res);
}

export interface GenerateTestResponse {
  filename: string;
  filePath: string;
  code: string;
  aiEnabled: boolean;
}

export interface GenerateTestOptions {
  targetUrl: string;
  steps: string;
  tags?: string;
  visualRegression?: boolean;
}

export async function generateTest(opts: GenerateTestOptions): Promise<GenerateTestResponse> {
  const res = await fetch('/api/generate-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return jsonOrThrow<GenerateTestResponse>(res);
}

// ─── Evidence types ───────────────────────────────────────────────────────────

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

export async function fetchRunEvidence(runId: string): Promise<RunEvidence> {
  return jsonOrThrow<RunEvidence>(
    await fetch(`/api/runs/${encodeURIComponent(runId)}/evidence`),
  );
}
