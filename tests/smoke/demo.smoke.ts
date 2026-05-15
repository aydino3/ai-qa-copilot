import { test, expect } from '@playwright/test';

// Demo smoke test — verifies the Manager View step timeline works end-to-end.
// Runs against example.com so no local server is required.
test(
  'Example.com page loads and has expected content',
  { tag: ['@smoke'] },
  async ({ page }) => {
    await test.step('Navigate to example.com', async () => {
      await page.goto('https://example.com');
      await expect(page).toHaveURL('https://example.com/');
    });

    await test.step('Verify page title is present', async () => {
      await expect(page).toHaveTitle(/Example Domain/i);
    });

    await test.step('Verify main heading is visible', async () => {
      await expect(page.getByRole('heading', { name: 'Example Domain' })).toBeVisible();
    });

    await test.step('Verify body text contains expected content', async () => {
      await expect(page.getByText('for use in illustrative examples')).toBeVisible();
    });

    await test.step('Verify "More information" link exists', async () => {
      await expect(page.getByRole('link', { name: /more information/i })).toBeVisible();
    });
  },
);
