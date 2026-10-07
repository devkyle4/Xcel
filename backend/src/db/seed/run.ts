// CLI entry: pnpm db:seed
import { getDatabase } from '../client';
import { seed } from './seed';

const database = getDatabase();
try {
  const counts = await seed(database);
  console.log(
    `Seeded ${counts.grades} grades, ${counts.subjects} subjects, ${counts.settings} settings.`,
  );
} finally {
  await database.sql.end();
}
