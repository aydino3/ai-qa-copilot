import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import { authStatePaths, AUTH_STATE_DIR } from '@fixtures/auth.fixture';

// Ensure the .auth directory exists (it's gitignored)
fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });

setup('authenticate as standard user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authStatePaths.user });
});

setup('authenticate as admin user', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(process.env.TEST_ADMIN_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.TEST_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authStatePaths.admin });
});
