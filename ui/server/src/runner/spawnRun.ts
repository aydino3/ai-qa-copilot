import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { FRAMEWORK_ROOT, RESULTS_JSON_PATH } from '../config.js';
import { runRegistry } from './runRegistry.js';

export interface RunOptions {
  grep?: string;
  project?: string;
  file?: string;
}

export interface StartedRun {
  id: string;
  args: string[];
  pid: number | undefined;
}

const activeChildren = new Map<string, ChildProcess>();

export function startRun(options: RunOptions): StartedRun {
  const args = buildPlaywrightArgs(options);
  const id = randomUUID();
  runRegistry.create(id, args);

  const child = spawn('npx', ['playwright', 'test', ...args], {
    cwd: FRAMEWORK_ROOT,
    env: process.env,
    shell: false,
  });
  activeChildren.set(id, child);

  child.stdout.on('data', (chunk: Buffer) => {
    runRegistry.appendLog(id, {
      stream: 'stdout',
      data: chunk.toString('utf8'),
      ts: Date.now(),
    });
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
    runRegistry.finalize(id, {
      status: 'error',
      exitCode: null,
      errorMessage: err.message,
    });
  });

  child.on('close', async (code) => {
    activeChildren.delete(id);
    const results = await readResultsJson();
    runRegistry.finalize(id, {
      status: code === 0 ? 'completed' : 'failed',
      exitCode: code,
      results,
    });
  });

  return { id, args, pid: child.pid };
}

export function cancelRun(id: string): boolean {
  const child = activeChildren.get(id);
  if (!child) return false;
  child.kill('SIGTERM');
  return true;
}

function buildPlaywrightArgs(opts: RunOptions): string[] {
  const args: string[] = ['--reporter=list,json'];
  if (opts.grep) args.push('--grep', opts.grep);
  if (opts.project) args.push('--project', opts.project);
  if (opts.file) args.push(opts.file);
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
