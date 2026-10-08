// pnpm --filter @xcel/backend db:seed:demo — fictional demo content for local development only.
// Add -- --remove to delete it again.
import { getDatabase } from '../client';
import { getEnv } from '../../env';
import { seed } from './seed';
import { removeDemo, seedDemo } from './demo';

if (getEnv().NODE_ENV === 'production' || /neon\.tech/.test(getEnv().DATABASE_URL)) {
  console.error('Refusing to load demo data into a production database.');
  process.exit(1);
}

const database = getDatabase();
try {
  if (process.argv.includes('--remove')) {
    const { removed } = await removeDemo(database);
    console.log(removed ? 'Demo data removed.' : 'No demo data found; nothing changed.');
  } else {
    await seed(database);
    const { created } = await seedDemo(database);
    console.log(
      created
        ? 'Demo data loaded: 3 universities with 1 programme each, and 3 scholarships.'
        : 'Demo data is already loaded; nothing changed.',
    );
  }
} finally {
  await database.sql.end();
}
