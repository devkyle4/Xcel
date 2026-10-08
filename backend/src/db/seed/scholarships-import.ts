import { ghanaToday } from '@xcel/shared';
import { inArray } from 'drizzle-orm';
import type { Database } from '../client';
import {
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  sources,
  verificationRecords,
} from '../schema';
import { RESEARCHED_ON, type ScholarshipRecord } from './data/ghana-undergraduate-scholarships';

/**
 * Imports researched scholarships. Idempotent by slug: existing scholarships
 * are left untouched so admin edits are never overwritten. Verified records
 * are published (or marked expired once their deadline has passed);
 * unverified ones stay as drafts with a pending verification.
 */
export async function importScholarships({ db }: Database, records: ScholarshipRecord[]) {
  const existing = new Set(
    (
      await db
        .select({ slug: scholarships.slug })
        .from(scholarships)
        .where(
          inArray(
            scholarships.slug,
            records.map((r) => r.slug),
          ),
        )
    ).map((r) => r.slug),
  );
  const toImport = records.filter((r) => !existing.has(r.slug));
  const today = ghanaToday();

  await db.transaction(async (tx) => {
    for (const record of toImport) {
      const closed =
        record.cycle.closed === true ||
        (record.cycle.closesOn !== null && record.cycle.closesOn < today);
      const status = !record.verified ? 'draft' : closed ? 'expired' : 'published';
      const [scholarship] = await tx
        .insert(scholarships)
        .values({
          slug: record.slug,
          name: record.name,
          providerName: record.providerName,
          providerUrl: record.providerUrl,
          logoUrl: record.logoUrl,
          description: record.description,
          coverage: record.coverage,
          studyLevels: record.studyLevels,
          fields: record.fields,
          eligibilityCategories: record.eligibilityCategories,
          location: record.location,
          status,
          ...(status !== 'draft' && { publishedAt: new Date() }),
        })
        .returning();
      const [cycle] = await tx
        .insert(scholarshipCycles)
        .values({
          scholarshipId: scholarship!.id,
          academicYear: record.cycle.academicYear,
          opensOn: record.cycle.opensOn,
          closesOn: record.cycle.closesOn,
          applicationUrl: record.cycle.applicationUrl,
        })
        .returning();
      await tx.insert(scholarshipRequirements).values(
        record.requirements.map((description, i) => ({
          cycleId: cycle!.id,
          description,
          sortOrder: i,
        })),
      );
      const [source] = await tx
        .insert(sources)
        .values({
          ...record.source,
          academicYear: record.cycle.academicYear,
          retrievedOn: RESEARCHED_ON,
          notes: record.verificationNote,
        })
        .returning();
      await tx.insert(verificationRecords).values({
        entityType: 'scholarship_cycle',
        entityId: cycle!.id,
        sourceId: source!.id,
        status: record.verified ? 'verified' : 'pending',
        verifiedAt: new Date(`${RESEARCHED_ON}T12:00:00Z`),
        notes: record.verificationNote,
      });
    }
  });

  return {
    imported: toImport.map((r) => r.slug),
    skipped: records.filter((r) => existing.has(r.slug)).map((r) => r.slug),
    drafts: toImport.filter((r) => !r.verified).map((r) => r.slug),
  };
}
