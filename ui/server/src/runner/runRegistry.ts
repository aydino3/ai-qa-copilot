import { EventEmitter } from 'node:events';

export type RunStatus = 'running' | 'completed' | 'failed' | 'error';

export interface LogChunk {
  stream: 'stdout' | 'stderr';
  data: string;
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
  results: unknown | null;
  errorMessage: string | null;
}

export interface RunEvents {
  log: (chunk: LogChunk) => void;
  status: (record: RunRecord) => void;
}

const MAX_LOG_CHUNKS = 5000;

class RunRegistry extends EventEmitter {
  private runs = new Map<string, RunRecord>();
  private activeId: string | null = null;

  hasActive(): boolean {
    return this.activeId !== null;
  }

  getActive(): RunRecord | null {
    return this.activeId ? (this.runs.get(this.activeId) ?? null) : null;
  }

  get(id: string): RunRecord | null {
    return this.runs.get(id) ?? null;
  }

  list(): Omit<RunRecord, 'logs'>[] {
    const out: Omit<RunRecord, 'logs'>[] = [];
    for (const record of this.runs.values()) {
      const { logs: _logs, ...summary } = record;
      void _logs;
      out.push(summary);
    }
    // Newest first.
    out.sort((a, b) => b.startedAt - a.startedAt);
    return out;
  }

  create(id: string, args: string[]): RunRecord {
    if (this.activeId) {
      throw new Error('A run is already active');
    }
    const record: RunRecord = {
      id,
      status: 'running',
      exitCode: null,
      startedAt: Date.now(),
      endedAt: null,
      args,
      logs: [],
      results: null,
      errorMessage: null,
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
    // Drop oldest chunks if the buffer grows unbounded (long-running suites).
    if (record.logs.length > MAX_LOG_CHUNKS) {
      record.logs.splice(0, record.logs.length - MAX_LOG_CHUNKS);
    }
    this.emit('log', { runId: id, chunk });
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
    this.emit('status', record);
  }
}

export const runRegistry = new RunRegistry();
