import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { resultsStore } from './lib/results-store';

// Pages are code-split; the first visit in a test file also compiles the page.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  // No real network in tests: pages that fetch without a mockApi() get an error response.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'No API mock for this request' }, { status: 503 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resultsStore.clear();
});
