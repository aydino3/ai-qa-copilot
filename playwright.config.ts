import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { Module } from 'node:module';

dotenv.config();

// Force Node (and all Playwright worker subprocesses) to resolve modules from
// the project-root node_modules. This fixes "Cannot find package
// '@google/generative-ai'" when a test file under src/ai/ is loaded by a
// worker whose CWD or module search path doesn't include the framework root.
const ROOT_NODE_MODULES = path.join(__dirname, 'node_modules');
process.env.NODE_PATH = process.env.NODE_PATH
  ? `${ROOT_NODE_MODULES}${path.delimiter}${process.env.NODE_PATH}`
  : ROOT_NODE_MODULES;
// Re-initialize the module search paths in the current process so the new
// NODE_PATH takes effect immediately (Node only reads NODE_PATH at startup).
(Module as unknown as { _initPaths: () => void })._initPaths();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // Extend Playwright's default to include our directory-based naming
  // convention (smoke/regression/visual/api) plus AI-generated tests.
  testMatch: '**/*.@(spec|test|smoke|regression|visual|api|ai-generated).?(c|m)[jt]s?(x)',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./src/reporters/step-stream.reporter.ts'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.15 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // API tests run without a browser context
    {
      name: 'api',
      testDir: './tests/api',
      use: { browserName: 'chromium' },
    },
  ],

  outputDir: 'test-results/',
});
