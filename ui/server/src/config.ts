import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 4000);

// Anchor to this file so the resolved framework root is independent of CWD.
// ui/server/src/config.ts → ../../..  = repo root
export const FRAMEWORK_ROOT =
  process.env.FRAMEWORK_ROOT ?? path.resolve(__dirname, '..', '..', '..');

export const PLAYWRIGHT_REPORT_DIR = path.join(FRAMEWORK_ROOT, 'playwright-report');
export const TEST_RESULTS_DIR = path.join(FRAMEWORK_ROOT, 'test-results');
export const RESULTS_JSON_PATH = path.join(TEST_RESULTS_DIR, 'results.json');
