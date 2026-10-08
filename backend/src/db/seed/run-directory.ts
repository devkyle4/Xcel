// pnpm --filter @xcel/backend db:seed:directory — Ghana's GTEC-accredited universities, without programmes.
import { getDatabase } from '../client';
import { GHANA_UNIVERSITIES } from './data/ghana-universities';
import { importUniversityDirectory } from './directory-import';

const database = getDatabase();
try {
  const result = await importUniversityDirectory(database, GHANA_UNIVERSITIES);
  console.log(
    `Added ${result.imported.length} universities; skipped ${result.skipped.length} already present.`,
  );
} finally {
  await database.sql.end();
}
