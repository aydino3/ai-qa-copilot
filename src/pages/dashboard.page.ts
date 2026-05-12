import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  get path(): string {
    return '/dashboard';
  }

  // The user menu acts as both the authenticated-state signal and the
  // logout entry point — if it's visible the session is active.
  private get userMenu() {
    return this.locateByTestId('user-menu');
  }

  private get logoutButton() {
    return this.locateByRole('button', { name: /^log.?out$/i });
  }

  protected override async waitForReady(): Promise<void> {
    await this.userMenu.waitFor({ state: 'visible' });
  }

  // Verifies the full authenticated contract: URL is correct AND the user
  // menu is rendered. URL check rules out cases where the nav shell renders
  // but the route guard hasn't redirected us yet.
  async assertAuthenticated(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.userMenu).toBeVisible();
  }

  // Non-retrying instant probe — used by best-effort cleanup hooks to skip
  // when there's no session to tear down. Does NOT wait.
  async hasActiveSession(): Promise<boolean> {
    return this.userMenu.isVisible();
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.waitFor({ state: 'visible' });
    await this.logoutButton.click();
  }
}
