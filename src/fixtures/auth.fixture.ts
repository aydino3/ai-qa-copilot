import { test as base, type Browser, type Page } from '@playwright/test';
import * as path from 'path';

// Anchored to this file's location so it resolves to the same absolute path
// regardless of where the test runner was invoked from (CI sub-shells,
// monorepo tooling, IDE extensions that change CWD).
export const AUTH_STATE_DIR = path.resolve(__dirname, '..', '..', '.auth');

export const authStatePaths = {
  user: path.join(AUTH_STATE_DIR, 'user.json'),
  admin: path.join(AUTH_STATE_DIR, 'admin.json'),
} as const;

type AuthFixtures = {
  /** Browser page pre-authenticated as a standard user. */
  authedPage: Page;
  /** Browser page pre-authenticated as an admin user. */
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const context = await browser.newContext({ storageState: authStatePaths.user });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const context = await browser.newContext({ storageState: authStatePaths.admin });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
