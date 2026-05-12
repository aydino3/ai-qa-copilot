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

  // Override the networkidle default with an explicit, deterministic signal
  protected override async waitForReady(): Promise<void> {
    await this.submitButton.waitFor({ state: 'visible' });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async assertVisible(): Promise<void> {
    await expect(this.submitButton).toBeVisible();
  }
}
