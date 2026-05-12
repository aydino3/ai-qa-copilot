import { test as base } from '@playwright/test';
import { ApiClient } from '@utils/api.client';

type CreatedResource = { type: string; id: string };

export type TestDataContext = {
  /** Track a resource created during the test so it's torn down automatically. */
  track(resource: CreatedResource): void;
  /** The API client for direct data setup/assertions. */
  api: ApiClient;
};

type DataFixtures = {
  testData: TestDataContext;
};

export const test = base.extend<DataFixtures>({
  testData: async ({ request }, use) => {
    const tracked: CreatedResource[] = [];
    const api = new ApiClient(request);

    const context: TestDataContext = {
      track(resource) {
        tracked.push(resource);
      },
      api,
    };

    await use(context);

    // Teardown: delete resources in reverse-creation order
    for (const resource of tracked.reverse()) {
      try {
        await api.delete(`/${resource.type}/${resource.id}`);
      } catch {
        // Log but don't fail the test — data cleanup is best-effort
        console.warn(`[testData] Failed to clean up ${resource.type}/${resource.id}`);
      }
    }
  },
});
