import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env itself. Variables already set in the
// environment (e.g. in CI or when targeting Neon) take precedence.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment.
}

// Migrations use the direct (unpooled) connection; PgBouncer transaction mode
// on Neon's pooled endpoint does not support everything migrations need.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  // Must match the casing option passed to drizzle() in src/db/client.ts.
  casing: 'snake_case',
  dbCredentials: { url },
  strict: true,
});
