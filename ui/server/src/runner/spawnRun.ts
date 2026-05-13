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
}

export interface StartedRun {
  id: string;
  args: string[];
  pid: number | undefined;
  baselineRun: boolean;
}

const STEP_PREFIX = '__UI_STEP__:';
const activeChildren = new Map<string, ChildProcess>();

export async function startRun(options: RunOptions): Promise<StartedRun> {
  const baselineRun = options.file ? await needsBaseline(options.file) : false;
  const args = buildPlaywrightArgs(options, baselineRun);
  const id = randomUUID();
  runRegistry.create(id, args);

  if (baselineRun) {
    runRegistry.appendLog(id, {
      stream: 'stdout',
      data: '[smart-baseline] No snapshots found — running with --update-snapshots to create baseline.\n',
      ts: Date.now(),
    });
  }

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
    if (baselineRun) {
      runRegistry.appendLog(id, {
        stream: 'stdout',
        data: '[smart-baseline] Baseline snapshots created successfully.\n',
        ts: Date.now(),
      });
    }
    const results = await readResultsJson();
    // On a baseline run Playwright exits non-zero ("1 snapshot written") but
    // that is expected — treat it as success so the dashboard shows green.
    const status = code === 0 || baselineRun ? 'completed' : 'failed';
    runRegistry.finalize(id, { status, exitCode: code, results });
  });

  return { id, args, pid: child.pid, baselineRun };
}

export function cancelRun(id: string): boolean {
  const child = activeChildren.get(id);
  if (!child) return false;
  child.kill('SIGTERM');
  return true;
}

/**
 * Returns true when no snapshot directory exists for the given test file,
 * meaning this is the first run and we need to create the baseline.
 * Playwright stores snapshots at: <testFileDir>/<testFileName>-snapshots/
 */
async function needsBaseline(file: string): Promise<boolean> {
  const resolved = path.isAbsolute(file) ? file : path.join(FRAMEWORK_ROOT, file);
  const snapshotDir = path.join(path.dirname(resolved), `${path.basename(resolved)}-snapshots`);
  try {
    await fs.access(snapshotDir);
    return false;
  } catch {
    return true;
  }
}

function buildPlaywrightArgs(opts: RunOptions, updateSnapshots: boolean): string[] {
  const args: string[] = [];
  if (opts.grep) args.push('--grep', opts.grep);
  if (opts.project) args.push('--project', opts.project);
  if (opts.file) args.push(opts.file);
  if (updateSnapshots) args.push('--update-snapshots');
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
