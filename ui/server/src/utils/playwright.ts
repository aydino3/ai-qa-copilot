import { spawn } from 'node:child_process';
import { FRAMEWORK_ROOT } from '../config.js';

export interface DiscoveredTest {
  title: string;
  file: string;
  line: number;
  column: number;
  projectName: string;
  tags: string[];
}

interface PwListJson {
  suites?: PwSuite[];
  config?: { rootDir?: string };
  errors?: { message: string; location?: { file: string; line: number; column: number } }[];
}

export interface DiscoveryResult {
  tests: DiscoveredTest[];
  errors: { message: string; file?: string; line?: number }[];
}

interface PwSuite {
  title?: string;
  file?: string;
  suites?: PwSuite[];
  specs?: PwSpec[];
}

interface PwSpec {
  title: string;
  file?: string;
  line: number;
  column: number;
  tags?: string[];
  tests?: { projectName: string }[];
}

/**
 * Shells `npx playwright test --list --reporter=json` from the framework
 * root and flattens the suite tree into a simple test list.
 */
export async function listTests(): Promise<DiscoveryResult> {
  const stdout = await runPlaywrightList();
  let parsed: PwListJson;
  try {
    parsed = JSON.parse(stdout) as PwListJson;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse playwright --list output: ${message}`);
  }
  const tests: DiscoveredTest[] = [];
  for (const suite of parsed.suites ?? []) {
    collectSpecs(suite, tests);
  }
  // "No tests found" is a synthetic error Playwright adds when discovery
  // produces zero specs; it's noise alongside real load-time errors.
  const errors = (parsed.errors ?? [])
    .filter((e) => e.message !== 'Error: No tests found')
    .map((e) => ({ message: e.message, file: e.location?.file, line: e.location?.line }));
  return { tests, errors };
}

function collectSpecs(suite: PwSuite, out: DiscoveredTest[]): void {
  for (const spec of suite.specs ?? []) {
    const file = spec.file ?? suite.file ?? '';
    const tags = spec.tags ?? [];
    for (const t of spec.tests ?? []) {
      out.push({
        title: spec.title,
        file,
        line: spec.line,
        column: spec.column,
        projectName: t.projectName,
        tags,
      });
    }
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, out);
  }
}

function runPlaywrightList(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'test', '--list', '--reporter=json'], {
      cwd: FRAMEWORK_ROOT,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (_code) => {
      // Playwright exits 1 when discovery hits load-time errors but still
      // emits valid JSON with an `errors` array; surface both via the parser
      // instead of treating non-zero as fatal here.
      if (!stdout.trim()) {
        reject(new Error(`playwright --list produced no output. stderr: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });
}
