import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

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
    ['./src/reporters/ai-enhanced.reporter.ts'],
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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
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
