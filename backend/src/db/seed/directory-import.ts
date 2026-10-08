import { inArray, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { sources, universities, verificationRecords } from '../schema';
import {
  DIRECTORY_CHECKED_ON,
  DIRECTORY_SOURCE,
  type DirectoryUniversity,
} from './data/ghana-universities';

/**
 * Adds universities to the directory, published and verified against the
 * GTEC list. Skips any university already present (by slug or name), so
 * admin edits and universities loaded with programmes are never touched.
 */
export async function importUniversityDirectory(
  { db }: Database,
  records: DirectoryUniversity[],
): Promise<{ imported: string[]; skipped: string[] }> {
  const existing = await db
    .select({ slug: universities.slug, name: universities.name })
    .from(universities)
    .where(
      sql`${inArray(
        universities.slug,
        records.map((r) => r.slug),
      )} OR lower(${universities.name}) IN (${sql.join(
        records.map((r) => sql`${r.name.toLowerCase()}`),
        sql`, `,
      )})`,
    );
  const taken = new Set(existing.flatMap((u) => [u.slug, u.name.toLowerCase()]));
  const toImport = records.filter((r) => !taken.has(r.slug) && !taken.has(r.name.toLowerCase()));
  const skipped = records.filter((r) => !toImport.includes(r)).map((r) => r.slug);
  if (toImport.length === 0) return { imported: [], skipped };

  await db.transaction(async (tx) => {
    const now = new Date();
    const verifiedAt = new Date(`${DIRECTORY_CHECKED_ON}T12:00:00Z`);
    const [source] = await tx
      .insert(sources)
      .values({
        ...DIRECTORY_SOURCE,
        retrievedOn: DIRECTORY_CHECKED_ON,
        notes:
          'Universities in the Traditional University, Public Technical University, Chartered Private Tertiary Institution and Private University categories, all with status Active.',
      })
      .returning();
    for (const { gtecCategory, nameNote, ...university } of toImport) {
      const [row] = await tx
        .insert(universities)
        .values({ ...university, status: 'published', publishedAt: now })
        .returning({ id: universities.id });
      await tx.insert(verificationRecords).values({
        entityType: 'university',
        entityId: row!.id,
        sourceId: source!.id,
        status: 'verified',
        verifiedAt,
        notes: [
          `Listed as accredited (Active) by GTEC under "${gtecCategory}" on ${DIRECTORY_CHECKED_ON}.`,
          nameNote,
          university.websiteUrl
            ? `Website opened on ${DIRECTORY_CHECKED_ON} to confirm it is the institution's own.`
            : 'No official website could be found.',
          'Region worked out from the town in the GTEC list.',
        ]
          .filter(Boolean)
          .join(' '),
      });
    }
  });
  return { imported: toImport.map((r) => r.slug), skipped };
}
