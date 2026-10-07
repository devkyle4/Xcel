import { sql } from 'drizzle-orm';
import type { Database } from '../client';
import { appSettings, grades, subjects } from '../schema';
import { gradeSeeds } from './grades';
import { settingSeeds } from './settings';
import { subjectSeeds } from './subjects';

/** Idempotent: safe to run repeatedly against the same database. */
export async function seed({ db }: Database) {
  await db.transaction(async (tx) => {
    await tx
      .insert(grades)
      .values(gradeSeeds)
      .onConflictDoUpdate({
        target: grades.code,
        set: {
          label: sql`excluded.label`,
          rank: sql`excluded.rank`,
          points: sql`excluded.points`,
          isPass: sql`excluded.is_pass`,
        },
      });

    await tx
      .insert(subjects)
      .values(subjectSeeds)
      .onConflictDoUpdate({
        target: subjects.code,
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          aliases: sql`excluded.aliases`,
        },
      });

    await tx.insert(appSettings).values(settingSeeds).onConflictDoNothing();
  });

  return {
    grades: gradeSeeds.length,
    subjects: subjectSeeds.length,
    settings: settingSeeds.length,
  };
}
