// pnpm --filter @xcel/backend db:seed:demo — fictional demo content for local development only.
import { getDatabase } from '../client';
import { getEnv } from '../../env';
import { seed } from './seed';
import { seedDemo } from './demo';

if (getEnv().NODE_ENV === 'production' || /neon\.tech/.test(getEnv().DATABASE_URL)) {
  console.error('Refusing to load demo data into a production database.');
  process.exit(1);
}

const database = getDatabase();
try {
  await seed(database);
  const { created } = await seedDemo(database);
  console.log(
    created
      ? 'Demo data loaded: 3 universities with 1 programme each, and 3 scholarships.'
      : 'Demo data is already loaded; nothing changed.',
  );
} finally {
  await database.sql.end();
}
