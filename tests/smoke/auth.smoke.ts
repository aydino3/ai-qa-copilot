import { test, expect } from '@fixtures/index';
import { LoginPage } from '@pages/login.page';
import { DashboardPage } from '@pages/dashboard.page';
import { requireEnv } from '@utils/env';

// Validated at module load — fails fast with a named-variable error if missing,
// independent of whether auth.setup ran for this invocation.
const USER_EMAIL = requireEnv('TEST_USER_EMAIL');
const USER_PASSWORD = requireEnv('TEST_USER_PASSWORD');

test.describe('Authentication @smoke', () => {
  // Best-effort session cleanup so failed runs don't accumulate server-side
  // sessions across retries. Skipped fast when no session is active.
  test.afterEach(async ({ page }) => {
    const dashboard = new DashboardPage(page);
    if (await dashboard.hasActiveSession()) {
      await dashboard.logout().catch(() => { /* nothing to clean up */ });
    }
  });

  test('login → verify dashboard → logout → verify redirect', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await loginPage.assertVisible();
    });

    await test.step('Submit valid credentials', async () => {
      await loginPage.login(USER_EMAIL, USER_PASSWORD);
    });

    await test.step('Verify redirect to dashboard', async () => {
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step('Verify authenticated user state', async () => {
      await dashboardPage.assertAuthenticated();
    });

    await test.step('Logout', async () => {
      await dashboardPage.logout();
    });

    await test.step('Verify redirect back to login', async () => {
      await expect(page).toHaveURL(/\/login/);
      await loginPage.assertVisible();
    });
  });
});
