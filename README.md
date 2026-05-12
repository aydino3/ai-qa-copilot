# AI QA Copilot

End-to-end test automation framework built on Playwright + TypeScript, with optional Claude-powered failure analysis.

The framework is designed for enterprise QA: deterministic page objects, fixture-based test data and auth, sharded CI execution, and structured reporting. AI features are opt-in — tests run identically with or without them.

---

## Quick start

```bash
# 1. Install dependencies
npm install
npx playwright install --with-deps

# 2. Configure environment
cp .env.example .env
# Fill in TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_ADMIN_EMAIL,
# TEST_ADMIN_PASSWORD, BASE_URL, API_BASE_URL

# 3. Run the smoke suite
npm run test:smoke
```

Missing or empty environment variables fail fast at module load with a named error.

---

## Project structure

```
src/
├── pages/             # Page Object Model
│   ├── base.page.ts   # Abstract base — scoped locators, soft assertions
│   ├── login.page.ts
│   └── dashboard.page.ts
├── components/        # Reserved for cross-page UI components
├── fixtures/          # Playwright fixture extensions
│   ├── auth.fixture.ts    # authedPage, adminPage (stored session)
│   ├── data.fixture.ts    # testData (API-backed seed/teardown)
│   └── index.ts           # Merged test export — single import for tests
├── reporters/
│   └── ai-enhanced.reporter.ts   # Annotates failures with Claude analysis
├── utils/
│   ├── api.client.ts  # Typed wrapper over Playwright's APIRequestContext
│   ├── env.ts         # requireEnv() — fail-fast env validation
│   └── retry.ts       # withRetry() — exponential backoff helper
└── ai/                # Reserved for AI integrations (failure analyzer, etc.)

test-data/
└── factories/         # BaseFactory<T> — typed test data builders

tests/
├── auth.setup.ts      # Logs in user + admin, saves storage state
├── smoke/             # Fast critical-path tests (@smoke)
├── regression/        # Full suite (@regression)
├── visual/            # Screenshot diffing
├── api/               # API-only tests, no browser
└── ai-generated/      # Quarantined AI-generated tests pending review
```

---

## Available scripts

| Script | Purpose |
|---|---|
| `npm test` | Run the full suite |
| `npm run test:smoke` | Run smoke tests only (`--grep @smoke`) |
| `npm run test:regression` | Run regression tests (`--grep @regression`) |
| `npm run test:visual` | Run visual diffing tests |
| `npm run test:api` | Run API-only tests |
| `npm run test:ci` | Sharded CI run (requires `SHARD_INDEX`, `SHARD_TOTAL`) |
| `npm run report` | Open the last HTML report |
| `npm run typecheck` | TypeScript type check, no emit |
| `npm run lint` | ESLint with Playwright plugin rules |

---

## Configuration

Required environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `BASE_URL` | URL of the application under test |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | Standard-user credentials for `auth.setup.ts` |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | Admin-user credentials |
| `API_BASE_URL` | Base URL for `ApiClient` (data setup/teardown) |
| `API_KEY` | Optional bearer token for `ApiClient` |
| `AI_ENABLED` | `true` to enable Claude-powered failure analysis |
| `ANTHROPIC_API_KEY` | Required only when `AI_ENABLED=true` |

---

## Architecture

**Page Object Model.** Tests never touch raw selectors. Every page extends `BasePage`, which exposes scoped locator helpers (`locateByRole`, `locateByTestId`, `locateByLabel`) and Playwright-native waiting via `expect(...).toPass()`. Page-specific readiness signals override `waitForReady()` instead of inheriting `networkidle`.

**Fixtures.** Auth and data fixtures compose via `mergeTests` and are imported as a single `test` from `@fixtures/index`. `authedPage` and `adminPage` deliver pre-authenticated browser contexts via storage state written by `auth.setup.ts`. `testData` tracks created resources and tears them down in reverse order.

**Projects.** Five Playwright projects: a `setup` project that runs `auth.setup.ts` once per run, three browser projects (`chromium`, `firefox`, `mobile-safari`) that depend on `setup`, and a browserless `api` project for contract tests.

**Path aliases.** Tests use `@fixtures/*`, `@pages/*`, `@utils/*`, `@ai/*`, and `@test-data/*` configured in `tsconfig.json`.

**Trace and screenshots.** `retain-on-failure` for traces, `only-on-failure` for screenshots, `retain-on-failure` for video. The first failed attempt is always captured.

---

## Adding a test

```ts
import { test, expect } from '@fixtures/index';
import { LoginPage } from '@pages/login.page';

test('example', { tag: '@smoke' }, async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  // ...
});
```

Conventions:

- One file per feature, named `<feature>.smoke.ts` / `<feature>.regression.ts` / etc. matching the directory.
- All selectors live inside POMs. The test never calls `page.locator()` directly.
- Use Playwright tags via the `{ tag: '@smoke' }` option, not in the title string.
- Use `test.step` for logical phases — they become named spans in traces and HTML reports.
- URL assertions belong at the test level; element assertions belong in POM methods.

---

## AI features (optional)

When `AI_ENABLED=true` and `ANTHROPIC_API_KEY` is set, the AI-enhanced reporter sends each failure's error and screenshots to Claude and prints a natural-language root-cause summary alongside the failure. The reporter batches calls with bounded concurrency so it does not serialize on large failure counts.

The AI layer (`src/ai/`) is isolated from test execution — it's only loaded when enabled. Tests run identically with or without it.

Planned future capabilities (`src/ai/`):

- Self-healing locators on selector failures
- Test generation from requirements/Jira tickets
- Flakiness pattern detection across run history
- Visual semantic diffing beyond pixel comparison

---

## CI

Tests run with `retries: 2` in CI and `0` locally. The CI runner is auto-detected via the `CI` environment variable.

Sharding:

```bash
SHARD_INDEX=1 SHARD_TOTAL=4 npm run test:ci
```

The `setup` project is a dependency of every browser project — auth state is rebuilt at the start of each shard.

---

## License

Internal use.
