import { defineConfig } from 'drizzle-kit';

// Migrations use the direct (unpooled) connection; PgBouncer transaction mode
// on Neon's pooled endpoint does not support everything migrations need.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
});
