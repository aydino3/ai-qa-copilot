import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FRAMEWORK_ROOT, RESULTS_JSON_PATH } from '../config.js';
import { runRegistry, type StepPayload } from './runRegistry.js';

export interface RunOptions {
  grep?: string;
  project?: string;
  file?: string;
  updateSnapshots?: boolean;
}

export interface StartedRun {
  id: string;
  args: string[];
  pid: number | undefined;
}

const STEP_PREFIX = '__UI_STEP__:';
const activeChildren = new Map<string, ChildProcess>();

export async function startRun(options: RunOptions): Promise<StartedRun> {
  const args = buildPlaywrightArgs(options);
  const id = randomUUID();
  runRegistry.create(id, args);

  const child = spawn('npx', ['playwright', 'test', ...args], {
    cwd: FRAMEWORK_ROOT,
    env: process.env,
    shell: false,
  });
  activeChildren.set(id, child);

  let stdoutBuffer = '';

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';

    let normalOutput = '';
    for (const line of lines) {
      if (line.startsWith(STEP_PREFIX)) {
        try {
          const payload = JSON.parse(line.slice(STEP_PREFIX.length)) as StepPayload;
          runRegistry.appendStep(id, payload);
        } catch {
          normalOutput += line + '\n';
        }
      } else {
        normalOutput += line + '\n';
      }
    }
    if (normalOutput) {
      runRegistry.appendLog(id, { stream: 'stdout', data: normalOutput, ts: Date.now() });
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    runRegistry.appendLog(id, {
      stream: 'stderr',
      data: chunk.toString('utf8'),
      ts: Date.now(),
    });
  });

  child.on('error', (err) => {
    activeChildren.delete(id);
    if (stdoutBuffer) {
      runRegistry.appendLog(id, { stream: 'stdout', data: stdoutBuffer, ts: Date.now() });
      stdoutBuffer = '';
    }
    runRegistry.finalize(id, { status: 'error', exitCode: null, errorMessage: err.message });
  });

  child.on('close', async (code) => {
    activeChildren.delete(id);
    if (stdoutBuffer) {
      runRegistry.appendLog(id, { stream: 'stdout', data: stdoutBuffer, ts: Date.now() });
      stdoutBuffer = '';
    }

    const results = await readResultsJson();
    const status = code === 0 ? 'completed' : 'failed';
    runRegistry.finalize(id, { status, exitCode: code, results });
  });

  return { id, args, pid: child.pid };
}

export function cancelRun(id: string): boolean {
  const child = activeChildren.get(id);
  if (!child) return false;
  child.kill('SIGTERM');
  return true;
}

/**
 * Returns true when no snapshot PNG files exist for the given test file.
 * Used by the UI to warn the user before running visual tests for the first time.
 */
export async function needsBaseline(file: string): Promise<boolean> {
  const resolved = path.isAbsolute(file) ? file : path.join(FRAMEWORK_ROOT, file);
  const snapshotDir = path.join(path.dirname(resolved), `${path.basename(resolved)}-snapshots`);
  try {
    const entries = await fs.readdir(snapshotDir, { recursive: true });
    return !entries.some((e) => /\.(png|jpg|jpeg)$/i.test(String(e)));
  } catch {
    return true;
  }
}

function buildPlaywrightArgs(opts: RunOptions): string[] {
  const args: string[] = [];
  if (opts.grep) args.push('--grep', opts.grep);
  if (opts.project) args.push('--project', opts.project);
  if (opts.file) args.push(opts.file);
  if (opts.updateSnapshots) args.push('--update-snapshots');
  return args;
}

async function readResultsJson(): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(RESULTS_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
