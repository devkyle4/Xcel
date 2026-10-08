import { defineConfig } from 'vitest/config';

// Integration tests against a real Postgres (TEST_DATABASE_URL). The global
// setup wipes that database and applies all migrations before the run.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment.
}

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL must be set (see .env.example) to run database tests');
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: the tests wipe it');
}

export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['./src/test/db-global-setup.ts'],
    env: { DATABASE_URL: testUrl },
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    // Random file order (seed is printed) so tests cannot quietly depend on each other.
    sequence: { shuffle: { files: true, tests: false } },
  },
});
