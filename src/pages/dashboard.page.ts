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
    return this.locateByRole('button', { name: /log.?out/i });
  }

  protected override async waitForReady(): Promise<void> {
    await this.userMenu.waitFor({ state: 'visible' });
  }

  // Called after a redirect-based arrival (post-login), not via goto(),
  // so we assert rather than navigate — expect has built-in retry.
  async assertAuthenticated(): Promise<void> {
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
