import { defineConfig } from 'vitest/config';

// Unit tests only. Database tests (*.db.test.ts) run via vitest.db.config.ts.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/*.db.test.ts'],
  },
});
