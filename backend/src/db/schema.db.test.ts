import { SETTING_KEYS } from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDatabase } from './client';
import {
  appSettings,
  auditLogs,
  grades,
  mentorRequestStats,
  mentors,
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  requirementRules,
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  sources,
  subjects,
  universities,
  verificationRecords,
} from './schema';
import { gradeSeeds } from './seed/grades';
import { seed } from './seed/seed';
import { subjectSeeds } from './seed/subjects';

const database = getDatabase();
const { db } = database;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

afterAll(async () => {
  await database.sql.end();
});

class Rollback extends Error {}

/** Runs fn in a transaction that is always rolled back, keeping tests isolated. */
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** Expects fn to fail with a Postgres error; returns the constraint name or message. */
async function violation(fn: (tx: Tx) => Promise<void>): Promise<string> {
  try {
    await inRollback(fn);
  } catch (error) {
    const pg = ((error as { cause?: unknown }).cause ?? error) as {
      constraint_name?: string;
      message: string;
    };
    return pg.constraint_name ?? pg.message;
  }
  throw new Error('Expected a database error, but the statements succeeded');
}

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}`;

async function createProgramme(tx: Tx, name = 'BSc Computer Engineering') {
  const [university] = await tx
    .insert(universities)
    .values({ slug: unique('uni'), name: 'Test University', institutionType: 'public_university' })
    .returning();
  const [programme] = await tx
    .insert(programmes)
    .values({ universityId: university!.id, slug: unique('prog'), name, degreeType: 'bachelor' })
    .returning();
  return programme!;
}

async function createCycle(tx: Tx, academicYear = '2026/2027') {
  const programme = await createProgramme(tx);
  const [cycle] = await tx
    .insert(programmeAdmissionCycles)
    .values({ programmeId: programme.id, academicYear })
    .returning();
  return cycle!;
}

describe('seed', () => {
  it('is idempotent and loads the grade scale and subjects', async () => {
    await seed(database);
    await seed(database);
    expect(await db.$count(grades)).toBe(gradeSeeds.length);
    expect(await db.$count(subjects)).toBe(subjectSeeds.length);

    const ordered = await db.select({ code: grades.code }).from(grades).orderBy(grades.rank);
    expect(ordered.map((g) => g.code)).toEqual([
      'A1',
      'B2',
      'B3',
      'C4',
      'C5',
      'C6',
      'D7',
      'E8',
      'F9',
    ]);
  });

  it('does not overwrite settings changed by an administrator', async () => {
    await seed(database);
    await db
      .update(appSettings)
      .set({ value: 90 })
      .where(eq(appSettings.key, SETTING_KEYS.staleAfterDays));
    await seed(database);
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SETTING_KEYS.staleAfterDays));
    expect(setting?.value).toBe(90);

    // Restore the default for test files that run afterwards.
    await db
      .update(appSettings)
      .set({ value: 365 })
      .where(eq(appSettings.key, SETTING_KEYS.staleAfterDays));
  });
});

describe('programme admission cycles', () => {
  it('accepts a valid academic year', async () => {
    await inRollback(async (tx) => {
      const cycle = await createCycle(tx, '2026/2027');
      expect(cycle.version).toBe(1);
    });
  });

  it.each(['2026/2028', '2026-2027', 'abcd/efgh'])('rejects academic year %s', async (year) => {
    expect(await violation((tx) => createCycle(tx, year).then(() => {}))).toBe(
      'programme_cycles_academic_year_format',
    );
  });

  it('allows only one published cycle per programme and academic year', async () => {
    expect(
      await violation(async (tx) => {
        const programme = await createProgramme(tx);
        await tx.insert(programmeAdmissionCycles).values([
          { programmeId: programme.id, academicYear: '2026/2027', version: 1, status: 'published' },
          { programmeId: programme.id, academicYear: '2026/2027', version: 2, status: 'published' },
        ]);
      }),
    ).toBe('programme_cycles_one_published_per_year_idx');
  });

  it('keeps older versions and other years alongside a published cycle', async () => {
    await inRollback(async (tx) => {
      const programme = await createProgramme(tx);
      const [v1] = await tx
        .insert(programmeAdmissionCycles)
        .values({ programmeId: programme.id, academicYear: '2026/2027', status: 'archived' })
        .returning();
      await tx.insert(programmeAdmissionCycles).values([
        {
          programmeId: programme.id,
          academicYear: '2026/2027',
          version: 2,
          supersedesCycleId: v1!.id,
          status: 'published',
        },
        { programmeId: programme.id, academicYear: '2027/2028', status: 'published' },
      ]);
    });
  });
});

describe('requirement groups and rules', () => {
  it('builds a nested AND / OR / any-N-of tree', async () => {
    await inRollback(async (tx) => {
      const cycle = await createCycle(tx);
      const [root] = await tx
        .insert(requirementGroups)
        .values({ cycleId: cycle.id, operator: 'all' })
        .returning();
      const [anyThree] = await tx
        .insert(requirementGroups)
        .values({ cycleId: cycle.id, parentGroupId: root!.id, operator: 'at_least', minCount: 3 })
        .returning();
      await tx.insert(requirementRules).values({
        groupId: anyThree!.id,
        ruleType: 'subject_grade',
        params: { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
      });
    });
  });

  it('allows only one root group per cycle', async () => {
    expect(
      await violation(async (tx) => {
        const cycle = await createCycle(tx);
        await tx.insert(requirementGroups).values([
          { cycleId: cycle.id, operator: 'all' },
          { cycleId: cycle.id, operator: 'any' },
        ]);
      }),
    ).toBe('requirement_groups_one_root_per_cycle_idx');
  });

  it.each([
    { operator: 'at_least' as const, minCount: null },
    { operator: 'at_least' as const, minCount: 0 },
    { operator: 'all' as const, minCount: 2 },
  ])('rejects operator $operator with minCount $minCount', async ({ operator, minCount }) => {
    expect(
      await violation(async (tx) => {
        const cycle = await createCycle(tx);
        await tx.insert(requirementGroups).values({ cycleId: cycle.id, operator, minCount });
      }),
    ).toBe('requirement_groups_min_count_matches_operator');
  });

  it('rejects a child group whose parent belongs to another cycle', async () => {
    expect(
      await violation(async (tx) => {
        const cycleA = await createCycle(tx);
        const cycleB = await createCycle(tx);
        const [rootA] = await tx
          .insert(requirementGroups)
          .values({ cycleId: cycleA.id, operator: 'all' })
          .returning();
        await tx
          .insert(requirementGroups)
          .values({ cycleId: cycleB.id, parentGroupId: rootA!.id, operator: 'any' });
      }),
    ).toBe('requirement_groups_parent_same_cycle_fk');
  });

  it('requires rule params to be a JSON object', async () => {
    expect(
      await violation(async (tx) => {
        const cycle = await createCycle(tx);
        const [root] = await tx
          .insert(requirementGroups)
          .values({ cycleId: cycle.id, operator: 'all' })
          .returning();
        await tx.insert(requirementRules).values({
          groupId: root!.id,
          ruleType: 'subject_grade',
          params: ['PHYSICS'] as unknown as Record<string, unknown>,
        });
      }),
    ).toBe('requirement_rules_params_object');
  });
});

describe('audit logs', () => {
  it('accepts inserts but rejects updates and deletes', async () => {
    await inRollback(async (tx) => {
      await tx.insert(auditLogs).values({ action: 'create', entityType: 'university' });
    });

    const updateError = await violation(async (tx) => {
      await tx.insert(auditLogs).values({ action: 'create', entityType: 'university' });
      await tx.update(auditLogs).set({ action: 'tampered' });
    });
    expect(updateError).toMatch(/append-only/);

    const deleteError = await violation(async (tx) => {
      await tx.insert(auditLogs).values({ action: 'create', entityType: 'university' });
      await tx.delete(auditLogs);
    });
    expect(deleteError).toMatch(/append-only/);
  });
});

describe('search', () => {
  it('finds programmes by stemmed full-text search and by misspelled name', async () => {
    await inRollback(async (tx) => {
      const programme = await createProgramme(tx, 'BSc Computer Engineering');

      const fullText = await tx
        .select({ id: programmes.id })
        .from(programmes)
        .where(sql`${programmes.searchVector} @@ websearch_to_tsquery('english', 'engineers')`);
      expect(fullText.map((r) => r.id)).toContain(programme.id);

      const fuzzy = await tx
        .select({ id: programmes.id })
        .from(programmes)
        .where(sql`similarity(${programmes.name}, 'Compter Enginering') > 0.3`);
      expect(fuzzy.map((r) => r.id)).toContain(programme.id);
    });
  });
});

describe('other constraints', () => {
  it('requires a source for a verified record', async () => {
    expect(
      await violation(async (tx) => {
        const cycle = await createCycle(tx);
        await tx.insert(verificationRecords).values({
          entityType: 'programme_admission_cycle',
          entityId: cycle.id,
          status: 'verified',
        });
      }),
    ).toBe('verification_records_verified_needs_source');

    await inRollback(async (tx) => {
      const cycle = await createCycle(tx);
      const [source] = await tx
        .insert(sources)
        .values({ title: 'Admission brochure', academicYear: '2026/2027' })
        .returning();
      await tx.insert(verificationRecords).values({
        entityType: 'programme_admission_cycle',
        entityId: cycle.id,
        sourceId: source!.id,
        status: 'verified',
      });
    });
  });

  it('stores mentor request stats per calendar month only', async () => {
    expect(
      await violation(async (tx) => {
        const [mentor] = await tx
          .insert(mentors)
          .values({
            slug: unique('mentor'),
            fullName: 'Ama Mensah',
            contactEmail: 'ama@example.com',
          })
          .returning();
        await tx.insert(mentorRequestStats).values({ mentorId: mentor!.id, month: '2026-10-07' });
      }),
    ).toBe('mentor_request_stats_month_start');
  });

  it('requires scholarship rule type and params together', async () => {
    expect(
      await violation(async (tx) => {
        const [scholarship] = await tx
          .insert(scholarships)
          .values({ slug: unique('sch'), name: 'Test Scholarship', providerName: 'Test Fund' })
          .returning();
        const [cycle] = await tx
          .insert(scholarshipCycles)
          .values({ scholarshipId: scholarship!.id, academicYear: '2026/2027' })
          .returning();
        await tx
          .insert(scholarshipRequirements)
          .values({ cycleId: cycle!.id, description: 'Female applicants', ruleType: 'gender' });
      }),
    ).toBe('scholarship_requirements_rule_complete');
  });
});
