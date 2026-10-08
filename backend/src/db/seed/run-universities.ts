// pnpm --filter @xcel/backend db:seed:universities — researched universities and their 2026/2027 programmes.
// Add -- --replace in development to reload after correcting a dataset.
import { getDatabase } from '../client';
import { KNUST } from './data/knust-2026';
import { UG } from './data/ug-2026';
import { getEnv } from '../../env';
import { importInstitution, removeInstitution } from './institution-import';
import { seed } from './seed';

// --replace (development only) removes previously imported data and loads the current datasets.
const replace = process.argv.includes('--replace');
if (replace && (getEnv().NODE_ENV === 'production' || /neon\.tech/.test(getEnv().DATABASE_URL))) {
  console.error('Refusing to replace university data in a production database.');
  process.exit(1);
}

const database = getDatabase();
try {
  await seed(database);
  for (const institution of [KNUST, UG]) {
    if (replace && (await removeInstitution(database, institution.university.slug))) {
      console.log(`Removed the previous ${institution.university.shortName} import.`);
    }
    const result = await importInstitution(database, institution);
    console.log(
      result.created
        ? `Loaded ${institution.university.shortName} with ${result.programmes} programmes for ${institution.academicYear}.`
        : `${institution.university.shortName} is already loaded; nothing changed.`,
    );
  }
} finally {
  await database.sql.end();
}
