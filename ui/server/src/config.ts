import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 4000);

// Prefer an explicit env override, then the known absolute deploy path,
// then fall back to resolving relative to this file (dev/CI).
export const FRAMEWORK_ROOT =
  process.env.FRAMEWORK_ROOT ??
  '/Users/aydin.ozkan1/Desktop/ai-qa-copilot-1' ??
  path.resolve(__dirname, '..', '..', '..');

export const PLAYWRIGHT_REPORT_DIR = path.join(FRAMEWORK_ROOT, 'playwright-report');
export const TEST_RESULTS_DIR = path.join(FRAMEWORK_ROOT, 'test-results');
export const RESULTS_JSON_PATH = path.join(TEST_RESULTS_DIR, 'results.json');
