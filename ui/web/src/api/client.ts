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

export async function cancelRun(runId: string): Promise<void> {
  await jsonOrThrow<{ ok: true }>(
    await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
  );
}
