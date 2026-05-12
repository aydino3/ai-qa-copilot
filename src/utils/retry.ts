type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

/**
 * Retries an async operation with exponential backoff.
 *
 * Default: 3 attempts, 1s base delay (1s → 2s → 4s).
 * Used for external dependencies (3rd-party APIs, DB seeds) that can be
 * transiently unavailable, NOT for Playwright assertions (use retries config).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, baseDelayMs = 1_000, shouldRetry = () => true } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !shouldRetry(error)) break;

      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
