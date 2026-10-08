// pnpm --filter @xcel/backend db:seed:scholarships — researched Ghanaian undergraduate scholarships.
import { getDatabase } from '../client';
import { GHANA_UNDERGRADUATE_SCHOLARSHIPS } from './data/ghana-undergraduate-scholarships';
import { importScholarships } from './scholarships-import';

const database = getDatabase();
try {
  const result = await importScholarships(database, GHANA_UNDERGRADUATE_SCHOLARSHIPS);
  console.log(
    `Imported ${result.imported.length}, skipped ${result.skipped.length} already present.`,
  );
  if (result.drafts.length) {
    console.log(`Left as unpublished drafts until verified: ${result.drafts.join(', ')}`);
  }
} finally {
  await database.sql.end();
}
