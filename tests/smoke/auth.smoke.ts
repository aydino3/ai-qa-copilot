import { test, expect } from '@fixtures/index';
import { LoginPage } from '@pages/login.page';
import { DashboardPage } from '@pages/dashboard.page';

// Credentials are validated eagerly in tests/auth.setup.ts, which is a
// dependency of every browser project. By the time this test runs they exist.
const USER_EMAIL = process.env.TEST_USER_EMAIL!;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

test.describe('Authentication @smoke', () => {
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
