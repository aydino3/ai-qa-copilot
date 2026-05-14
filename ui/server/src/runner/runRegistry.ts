import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type RunStatus = 'running' | 'completed' | 'failed' | 'error';

export interface LogChunk {
  stream: 'stdout' | 'stderr';
  data: string;
  ts: number;
}

export interface StepPayload {
  action: 'start' | 'end';
  title: string;
  status?: 'passed' | 'failed';
  error?: string | null;
  ts: number;
}

export interface RunRecord {
  id: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  args: string[];
  logs: LogChunk[];
  steps: StepPayload[];
  results: unknown | null;
  errorMessage: string | null;
  /** Cached evidence payload, set once on finalize to avoid re-parsing on every request. */
  _evidenceCache?: unknown;
}

export type RunSummaryRecord = Omit<RunRecord, 'logs' | 'steps' | 'results' | '_evidenceCache'>;

const MAX_LOG_CHUNKS = 5000;
const MAX_STEP_EVENTS = 2000;

// Resolved lazily so config can be loaded before the file is read.
let _historyPath: string | null = null;
function historyPath(): string {
  if (!_historyPath) {
    // Inline to avoid circular dep with config.ts
    const root = process.env.FRAMEWORK_ROOT ?? path.resolve(new URL(import.meta.url).pathname, '..', '..', '..', '..', '..');
    _historyPath = path.join(root, 'test-results', 'runs.jsonl');
  }
  return _historyPath;
}

function persistRecord(record: RunRecord): void {
  const summary: Omit<RunRecord, 'logs' | 'steps' | '_evidenceCache'> = (() => {
    const { logs: _l, steps: _s, _evidenceCache: _e, ...rest } = record;
    void _l; void _s; void _e;
    return rest;
  })();
  try {
    fs.mkdirSync(path.dirname(historyPath()), { recursive: true });
    fs.appendFileSync(historyPath(), JSON.stringify(summary) + '\n', 'utf8');
  } catch {
    // Non-fatal — history loss on disk error is acceptable
  }
}

function loadHistory(): RunRecord[] {
  try {
    const raw = fs.readFileSync(historyPath(), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const r = JSON.parse(line) as RunRecord;
        r.logs = [];
        r.steps = [];
        return r;
      });
  } catch {
    return [];
  }
}

class RunRegistry extends EventEmitter {
  private runs = new Map<string, RunRecord>();
  private activeId: string | null = null;

  constructor() {
    super();
    for (const record of loadHistory()) {
      this.runs.set(record.id, record);
    }
  }

  hasActive(): boolean {
    return this.activeId !== null;
  }

  getActive(): RunRecord | null {
    return this.activeId ? (this.runs.get(this.activeId) ?? null) : null;
  }

  get(id: string): RunRecord | null {
    return this.runs.get(id) ?? null;
  }

  list(): RunSummaryRecord[] {
    const out: RunSummaryRecord[] = [];
    for (const record of this.runs.values()) {
      const { logs: _l, steps: _s, results: _r, _evidenceCache: _e, ...summary } = record;
      void _l; void _s; void _r; void _e;
      out.push(summary);
    }
    out.sort((a, b) => b.startedAt - a.startedAt);
    return out;
  }

  create(id: string, args: string[]): RunRecord {
    if (this.activeId) throw new Error('A run is already active');
    const record: RunRecord = {
      id, status: 'running', exitCode: null,
      startedAt: Date.now(), endedAt: null,
      args, logs: [], steps: [], results: null, errorMessage: null,
    };
    this.runs.set(id, record);
    this.activeId = id;
    this.emit('status', record);
    return record;
  }

  appendLog(id: string, chunk: LogChunk): void {
    const record = this.runs.get(id);
    if (!record) return;
    record.logs.push(chunk);
    if (record.logs.length > MAX_LOG_CHUNKS) {
      record.logs.splice(0, record.logs.length - MAX_LOG_CHUNKS);
    }
    this.emit('log', { runId: id, chunk });
  }

  appendStep(id: string, payload: StepPayload): void {
    const record = this.runs.get(id);
    if (!record) return;
    record.steps.push(payload);
    if (record.steps.length > MAX_STEP_EVENTS) {
      record.steps.splice(0, record.steps.length - MAX_STEP_EVENTS);
    }
    this.emit('step', { runId: id, payload });
  }

  finalize(
    id: string,
    patch: Partial<Pick<RunRecord, 'status' | 'exitCode' | 'results' | 'errorMessage'>>
  ): void {
    const record = this.runs.get(id);
    if (!record) return;
    Object.assign(record, patch);
    record.endedAt = Date.now();
    if (this.activeId === id) this.activeId = null;
    persistRecord(record);
    this.emit('status', record);
  }
}

export const runRegistry = new RunRegistry();
