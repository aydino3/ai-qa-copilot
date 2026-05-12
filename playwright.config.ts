import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // Extend Playwright's default to include our directory-based naming
  // convention (smoke/regression/visual/api). Setup files are matched by
  // the setup project's own testMatch and excluded from this pattern.
  testMatch: '**/*.@(spec|test|smoke|regression|visual|api).?(c|m)[jt]s?(x)',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./src/reporters/ai-enhanced.reporter.ts'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Global auth setup — runs once before browser projects
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
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
