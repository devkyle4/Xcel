import { validateRequirementTree } from '@xcel/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  facultySchools,
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  sources,
  universities,
  verificationRecords,
} from '../schema';
import { replaceRequirementTree } from '../../lib/requirements';
import { loadCatalogue } from '../../modules/catalogue';
import type { InstitutionDataset } from './data/builders';

/**
 * Loads a university and its programmes for one admission cycle, published
 * and verified against the official source. Does nothing if the university
 * already exists, so admin edits are never overwritten. Refuses to load a
 * requirement tree the eligibility engine would not accept.
 */
export async function importInstitution(
  { db }: Database,
  data: InstitutionDataset,
): Promise<{ created: boolean; programmes: number }> {
  const [existing] = await db
    .select({ id: universities.id })
    .from(universities)
    .where(eq(universities.slug, data.university.slug));
  if (existing) return { created: false, programmes: 0 };

  const catalogue = await loadCatalogue(db);
  for (const programme of data.programmes) {
    // The validator only needs the tree's shape; node ids are generated on save.
    const issues = validateRequirementTree(
      JSON.parse(JSON.stringify(programme.requirements)),
      catalogue,
    );
    if (issues.length > 0) {
      throw new Error(
        `${data.university.shortName} ${programme.name}: ${issues.map((i) => i.message).join('; ')}`,
      );
    }
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    const verifiedAt = new Date(`${data.checkedOn}T12:00:00Z`);
    const [source] = await tx
      .insert(sources)
      .values({
        ...data.source,
        academicYear: data.academicYear,
        retrievedOn: data.checkedOn,
        notes: data.verificationNote,
      })
      .returning();
    const verify = (entityType: 'university' | 'programme_admission_cycle', entityId: string) =>
      tx.insert(verificationRecords).values({
        entityType,
        entityId,
        sourceId: source!.id,
        status: 'verified',
        verifiedAt,
        notes: data.verificationNote,
      });

    const [university] = await tx
      .insert(universities)
      .values({ ...data.university, status: 'published', publishedAt: now })
      .returning();
    await verify('university', university!.id);

    const facultyIds = new Map<string, string>();
    for (const name of new Set(data.programmes.map((p) => p.faculty))) {
      const [faculty] = await tx
        .insert(facultySchools)
        .values({ universityId: university!.id, name })
        .returning();
      facultyIds.set(name, faculty!.id);
    }

    for (const programme of data.programmes) {
      const [row] = await tx
        .insert(programmes)
        .values({
          universityId: university!.id,
          facultySchoolId: facultyIds.get(programme.faculty)!,
          slug: programme.slug,
          name: programme.name,
          field: programme.field,
          degreeType: programme.degreeType,
          campus: programme.campus,
          status: 'published',
          publishedAt: now,
        })
        .returning();
      // Requirements can only be added while the cycle is a draft; then it is published.
      const [cycle] = await tx
        .insert(programmeAdmissionCycles)
        .values({
          programmeId: row!.id,
          academicYear: data.academicYear,
          applicationUrl: data.applicationUrl,
          notes: programme.notes,
        })
        .returning();
      await replaceRequirementTree(tx, cycle!.id, programme.requirements);
      await verify('programme_admission_cycle', cycle!.id);
      await tx
        .update(programmeAdmissionCycles)
        .set({ status: 'published', verifiedAt: now, publishedAt: now })
        .where(and(eq(programmeAdmissionCycles.id, cycle!.id)));
    }
  });

  return { created: true, programmes: data.programmes.length };
}

/**
 * Development only: removes a university and everything imported with it, so
 * a corrected dataset can be loaded again. Published cycles are protected by
 * the history triggers, which are switched off only inside this transaction.
 */
export async function removeInstitution({ db }: Database, slug: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [university] = await tx
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.slug, slug));
    if (!university) return false;
    const programmeIds = (
      await tx
        .select({ id: programmes.id })
        .from(programmes)
        .where(eq(programmes.universityId, university.id))
    ).map((p) => p.id);
    const cycleIds = programmeIds.length
      ? (
          await tx
            .select({ id: programmeAdmissionCycles.id })
            .from(programmeAdmissionCycles)
            .where(inArray(programmeAdmissionCycles.programmeId, programmeIds))
        ).map((c) => c.id)
      : [];

    await tx
      .delete(verificationRecords)
      .where(inArray(verificationRecords.entityId, [university.id, ...programmeIds, ...cycleIds]));
    const frozen = ['programme_admission_cycles', 'requirement_groups', 'requirement_rules'];
    for (const table of frozen)
      await tx.execute(sql.raw(`ALTER TABLE ${table} DISABLE TRIGGER USER`));
    if (cycleIds.length) {
      await tx.delete(requirementGroups).where(inArray(requirementGroups.cycleId, cycleIds));
      await tx
        .delete(programmeAdmissionCycles)
        .where(inArray(programmeAdmissionCycles.id, cycleIds));
    }
    for (const table of frozen)
      await tx.execute(sql.raw(`ALTER TABLE ${table} ENABLE TRIGGER USER`));
    if (programmeIds.length)
      await tx.delete(programmes).where(inArray(programmes.id, programmeIds));
    await tx.delete(universities).where(eq(universities.id, university.id));
    return true;
  });
}
