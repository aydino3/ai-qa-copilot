import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  TestStep,
} from '@playwright/test/reporter';

type FailureRecord = {
  title: string;
  file: string;
  error: string;
  attachments: string[];
};

/**
 * Wraps Playwright's built-in reporters and enriches failure output.
 *
 * When AI_ENABLED=true this reporter will delegate to src/ai/failure-analyzer.ts
 * to produce natural-language root-cause summaries alongside each failure.
 * The stub below is ready for that integration without changing test code.
 */
export default class AIEnhancedReporter implements Reporter {
  private readonly failures: FailureRecord[] = [];
  private readonly aiEnabled = process.env.AI_ENABLED === 'true';

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    const screenshotPaths = result.attachments
      .filter((a) => a.contentType === 'image/png' && a.path)
      .map((a) => a.path as string);

    this.failures.push({
      title: test.titlePath().join(' > '),
      file: test.location.file,
      error: result.error?.message?.split('\n')[0] ?? 'Unknown error',
      attachments: screenshotPaths,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStepEnd(_test: TestCase, _result: TestResult, _step: TestStep): void {
    // Reserved for step-level timing metrics fed into flakiness-detector
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.failures.length === 0) return;

    console.log(`\n[AI Reporter] ${this.failures.length} test(s) failed.\n`);

    if (!this.aiEnabled) {
      console.log('[AI Reporter] Set AI_ENABLED=true to enable root-cause analysis.\n');
      this.printFailureSummary();
      return;
    }

    await this.runAIAnalysis();
  }

  private printFailureSummary(): void {
    for (const f of this.failures) {
      console.log(`  ✗ ${f.title}`);
      console.log(`    ${f.error}`);
      if (f.attachments.length > 0) {
        console.log(`    Screenshots: ${f.attachments.join(', ')}`);
      }
      console.log();
    }
  }

  private async runAIAnalysis(): Promise<void> {
    // Dynamically imported so the module is only resolved when AI_ENABLED=true,
    // keeping the standard test run free of Anthropic SDK overhead.
    const { analyzeFailure } = await import('../ai/failure-analyzer');

    const CONCURRENCY = 5;

    for (let i = 0; i < this.failures.length; i += CONCURRENCY) {
      const batch = this.failures.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((f) => analyzeFailure({ error: f.error, screenshotPaths: f.attachments }))
      );

      for (let j = 0; j < batch.length; j++) {
        const f = batch[j];
        const result = settled[j];
        console.log(`  ✗ ${f.title}`);
        if (result.status === 'fulfilled') {
          console.log(`    [AI] ${result.value}`);
        } else {
          console.log(`    [AI] Analysis unavailable`);
          console.log(`    ${f.error}`);
        }
        console.log();
      }
    }
  }
}
