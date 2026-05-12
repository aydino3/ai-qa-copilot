import { test, expect } from '@fixtures/index';
import { LoginPage } from '@pages/login.page';
import { DashboardPage } from '@pages/dashboard.page';
import { requireEnv } from '@utils/env';

// Validated at module load — fails fast with a named-variable error if missing,
// independent of whether auth.setup ran for this invocation.
const USER_EMAIL = requireEnv('TEST_USER_EMAIL');
const USER_PASSWORD = requireEnv('TEST_USER_PASSWORD');

test.describe('Authentication', () => {
  // Best-effort session cleanup so failed runs don't accumulate server-side
  // sessions across retries. Skipped fast when no session is active.
  test.afterEach(async ({ page }, testInfo) => {
    const dashboard = new DashboardPage(page);
    if (await dashboard.hasActiveSession()) {
      await dashboard.logout().catch((error: Error) => {
        // Surface cleanup regressions in CI logs — silent swallowing would
        // hide a renamed logout button until session limits are hit days later.
        console.warn(
          `[cleanup] logout failed for "${testInfo.title}": ${error.message}`
        );
      });
    }
  });

  test(
    'login → verify dashboard → logout → verify redirect',
    { tag: '@smoke' },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await test.step('Navigate to login page', async () => {
        await loginPage.goto();
        // Guard against a pre-existing session redirecting away from /login
        await expect(page).toHaveURL(/\/login/);
      });

      await test.step('Submit valid credentials', async () => {
        await loginPage.login(USER_EMAIL, USER_PASSWORD);
      });

      await test.step('Verify authenticated dashboard state', async () => {
        await dashboardPage.assertAuthenticated();
      });

      await test.step('Logout', async () => {
        await dashboardPage.logout();
      });

      await test.step('Verify redirect back to login', async () => {
        await expect(page).toHaveURL(/\/login/);
        await loginPage.assertVisible();
      });
    }
  );
});
