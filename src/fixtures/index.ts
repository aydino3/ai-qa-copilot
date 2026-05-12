import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth.fixture';
import { test as dataTest } from './data.fixture';

// Single import for all tests — extend this as new fixture files are added
export const test = mergeTests(authTest, dataTest);
export { expect } from '@playwright/test';
