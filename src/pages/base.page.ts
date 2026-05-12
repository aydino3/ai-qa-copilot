import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Subclasses declare the route they own
  abstract get path(): string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitForReady();
  }

  // Override in subclasses if the page has a specific ready signal
  protected async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // Scoped locator — keeps selectors inside the POM, never leaking into tests
  protected locate(selector: string): Locator {
    return this.page.locator(selector);
  }

  protected locateByRole(
    role: Parameters<Page['getByRole']>[0],
    options?: Parameters<Page['getByRole']>[1]
  ): Locator {
    return this.page.getByRole(role, options);
  }

  protected locateByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  // Soft assertions accumulate failures without stopping the test;
  // Playwright flushes them at the end of each test automatically.
  protected async softAssertVisible(locator: Locator, message?: string): Promise<void> {
    await expect.soft(locator, message).toBeVisible();
  }

  protected async softAssertText(
    locator: Locator,
    expected: string | RegExp,
    message?: string
  ): Promise<void> {
    await expect.soft(locator, message).toHaveText(expected);
  }

  // Polls a condition with a configurable interval before Playwright's built-in
  // timeout kicks in — useful for slow eventually-consistent UI state.
  protected async waitForCondition(
    condition: () => Promise<boolean>,
    { timeout = 10_000, interval = 500 } = {}
  ): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await condition()) return;
      await this.page.waitForTimeout(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
