import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  get path(): string {
    return '/login';
  }

  private get emailInput() {
    return this.locateByLabel('Email');
  }

  private get passwordInput() {
    return this.locateByLabel('Password');
  }

  private get submitButton() {
    return this.locateByRole('button', { name: 'Sign in' });
  }

  // Scoped to the form that owns the Sign in button so role="alert" matches
  // login errors only — not cookie banners, system toasts, or other live
  // regions that share the alert role.
  private get errorAlert() {
    return this.page
      .locator('form', { has: this.page.getByRole('button', { name: 'Sign in' }) })
      .getByRole('alert');
  }

  // Override the networkidle default with an explicit, deterministic signal
  protected override async waitForReady(): Promise<void> {
    await this.submitButton.waitFor({ state: 'visible' });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();

    // Fail fast with a domain-meaningful error if the server rejected the
    // credentials. Passes instantly on the happy path (alert never appears).
    await expect(
      this.errorAlert,
      'Login was rejected — error alert is visible on page'
    ).not.toBeVisible({ timeout: 3_000 });
  }

  async assertVisible(): Promise<void> {
    await expect(this.submitButton).toBeVisible();
  }
}
