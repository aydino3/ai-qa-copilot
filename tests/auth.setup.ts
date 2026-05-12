import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import { authStatePaths, AUTH_STATE_DIR } from '@fixtures/auth.fixture';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable "${name}" is not set. Copy .env.example to .env and fill in all values.`
    );
  }
  return value;
}

// Validate all required vars before any test runs
const USER_EMAIL = requireEnv('TEST_USER_EMAIL');
const USER_PASSWORD = requireEnv('TEST_USER_PASSWORD');
const ADMIN_EMAIL = requireEnv('TEST_ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('TEST_ADMIN_PASSWORD');

// Ensure the .auth directory exists (it's gitignored)
fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });

setup('authenticate as standard user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authStatePaths.user });
});

setup('authenticate as admin user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authStatePaths.admin });
});
