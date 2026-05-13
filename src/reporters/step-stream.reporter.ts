import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

const PREFIX = '__UI_STEP__:';

// Only surface user-authored test.step() blocks. In Playwright 1.44+
// the category for test.step() is 'test.step'. Internal categories
// ('fixture', 'hook', 'pw:api', 'test.attach') are suppressed.
const USER_CATEGORIES = new Set(['test.step']);

class StepStreamReporter implements Reporter {
  private emit(payload: Record<string, unknown>): void {
    process.stdout.write(PREFIX + JSON.stringify(payload) + '\n');
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (!USER_CATEGORIES.has(step.category)) return;
    this.emit({
      action: 'start',
      title: step.title,
      ts: Date.now(),
    });
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (!USER_CATEGORIES.has(step.category)) return;
    this.emit({
      action: 'end',
      title: step.title,
      status: step.error ? 'failed' : 'passed',
      error: step.error?.message ?? null,
      ts: Date.now(),
    });
  }
}

export default StepStreamReporter;
