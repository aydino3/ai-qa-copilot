import { test as base, type Browser, type Page } from '@playwright/test';
import * as path from 'path';

export const AUTH_STATE_DIR = path.join(process.cwd(), '.auth');

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
