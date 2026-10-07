import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../env';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

function createDatabase(url: string) {
  const sql = postgres(url, {
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which does not
    // support prepared statements. Each serverless instance needs one connection.
    prepare: false,
    max: 1,
    idle_timeout: 20,
  });
  return { sql, db: drizzle(sql, { schema }) };
}

// Module-level cache so warm serverless invocations reuse the connection.
let instance: Database | undefined;

export function getDatabase(): Database {
  instance ??= createDatabase(getEnv().DATABASE_URL);
  return instance;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getDatabase().sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
