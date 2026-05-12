import type { APIRequestContext } from '@playwright/test';

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
};

type JsonBody = Record<string, unknown> | unknown[];

/**
 * Typed wrapper around Playwright's APIRequestContext.
 *
 * Used by fixtures and test data factories for backend setup/teardown.
 * Throws on non-2xx responses so callers don't have to check status manually.
 */
export class ApiClient {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(
    private readonly request: APIRequestContext,
    options: { baseURL?: string; apiKey?: string } = {}
  ) {
    this.baseURL = options.baseURL ?? process.env.API_BASE_URL ?? '';
    this.defaultHeaders = options.apiKey
      ? { Authorization: `Bearer ${options.apiKey}` }
      : process.env.API_KEY
        ? { Authorization: `Bearer ${process.env.API_KEY}` }
        : {};
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request.get(this.url(path), {
      headers: this.headers(options.headers),
      params: options.params,
    });
    return this.parse<T>(response);
  }

  async post<T>(path: string, body: JsonBody, options: RequestOptions = {}): Promise<T> {
    const response = await this.request.post(this.url(path), {
      headers: this.headers(options.headers),
      data: body,
    });
    return this.parse<T>(response);
  }

  async put<T>(path: string, body: JsonBody, options: RequestOptions = {}): Promise<T> {
    const response = await this.request.put(this.url(path), {
      headers: this.headers(options.headers),
      data: body,
    });
    return this.parse<T>(response);
  }

  async patch<T>(path: string, body: Partial<JsonBody>, options: RequestOptions = {}): Promise<T> {
    const response = await this.request.patch(this.url(path), {
      headers: this.headers(options.headers),
      data: body,
    });
    return this.parse<T>(response);
  }

  async delete(path: string, options: RequestOptions = {}): Promise<void> {
    const response = await this.request.delete(this.url(path), {
      headers: this.headers(options.headers),
    });
    if (!response.ok()) {
      throw new Error(`DELETE ${path} failed: ${response.status()} ${response.statusText()}`);
    }
  }

  private url(path: string): string {
    return `${this.baseURL}${path}`;
  }

  private headers(overrides?: Record<string, string>): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.defaultHeaders, ...overrides };
  }

  private async parse<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `API ${response.status()} ${response.statusText()}: ${body.slice(0, 200)}`
      );
    }
    return response.json() as Promise<T>;
  }
}
