import { ghanaToday, type RequirementGroupInput } from '@xcel/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  sources,
  universities,
  userReports,
  verificationRecords,
} from '../schema';
import { replaceRequirementTree } from '../../lib/requirements';

/**
 * Fictional demo content for local development: 3 universities with one
 * programme each, and 3 scholarships (open, opening soon, closed). Names are
 * invented and links use example.com so nothing can be mistaken for official
 * information. Never run against production.
 */

const grade = (minGrade: string, ...subjectCodes: string[]) => ({
  kind: 'rule' as const,
  ruleType: 'subject_grade',
  params: { subjectCodes, minGrade },
});

const DEMO_UNIVERSITIES = [
  {
    slug: 'demo-university-of-accra',
    name: 'Demo University of Accra',
    shortName: 'DUA',
    institutionType: 'public_university' as const,
    region: 'greater_accra' as const,
    town: 'Accra',
    description: 'A fictional public university used as demo data.',
    websiteUrl: 'https://dua.example.com',
    admissionsUrl: 'https://dua.example.com/admissions',
    programme: {
      slug: 'bsc-computer-science',
      name: 'BSc Computer Science',
      field: 'Computer Science',
      degreeType: 'bachelor' as const,
      durationYears: 4,
      description: 'Programming, algorithms, data and systems.',
      // Core credits, Elective Maths, any 2 of Physics / Chemistry / ICT, aggregate 24 or better.
      requirements: {
        kind: 'group',
        operator: 'all',
        children: [
          grade('C6', 'ENGLISH'),
          grade('C6', 'CORE_MATHS'),
          grade('C6', 'INTEGRATED_SCIENCE'),
          grade('C6', 'ELECTIVE_MATHS'),
          {
            kind: 'rule',
            ruleType: 'subject_count',
            params: {
              count: 2,
              minGrade: 'C6',
              subjectCodes: ['PHYSICS', 'CHEMISTRY', 'ELECTIVE_ICT'],
            },
          },
          {
            kind: 'rule',
            ruleType: 'aggregate_max',
            params: {
              maxAggregate: 24,
              components: [
                { subjectCodes: ['ENGLISH'], count: 1 },
                { subjectCodes: ['CORE_MATHS'], count: 1 },
                { subjectCodes: ['INTEGRATED_SCIENCE', 'SOCIAL_STUDIES'], count: 1 },
                { category: 'elective', count: 3 },
              ],
            },
          },
        ],
      } satisfies RequirementGroupInput,
    },
  },
  {
    slug: 'demo-technical-university-kumasi',
    name: 'Demo Technical University, Kumasi',
    shortName: 'DTUK',
    institutionType: 'technical_university' as const,
    region: 'ashanti' as const,
    town: 'Kumasi',
    description: 'A fictional technical university used as demo data.',
    websiteUrl: 'https://dtuk.example.com',
    admissionsUrl: null,
    programme: {
      slug: 'hnd-civil-engineering',
      name: 'HND Civil Engineering',
      field: 'Engineering',
      degreeType: 'hnd' as const,
      durationYears: 3,
      description: 'Construction, surveying and structures.',
      // Core English and Maths, plus Physics OR Technical Drawing OR Building Construction.
      requirements: {
        kind: 'group',
        operator: 'all',
        children: [
          grade('C6', 'ENGLISH'),
          grade('C6', 'CORE_MATHS'),
          {
            kind: 'group',
            operator: 'any',
            label: 'One technical subject',
            children: [
              grade('C6', 'PHYSICS'),
              grade('C6', 'TECHNICAL_DRAWING'),
              grade('C6', 'BUILDING_CONSTRUCTION'),
            ],
          },
        ],
      } satisfies RequirementGroupInput,
    },
  },
  {
    slug: 'demo-university-college-cape-coast',
    name: 'Demo University College, Cape Coast',
    shortName: 'DUCC',
    institutionType: 'private_university' as const,
    region: 'central' as const,
    town: 'Cape Coast',
    description: 'A fictional private university college used as demo data.',
    websiteUrl: 'https://ducc.example.com',
    admissionsUrl: 'https://ducc.example.com/apply',
    programme: {
      slug: 'ba-education',
      name: 'BA Education',
      field: 'Education',
      degreeType: 'bachelor' as const,
      durationYears: 4,
      description: 'Teaching, learning and educational leadership.',
      // Core English and Maths, any 3 electives at C6, and an interview (makes results "Likely eligible").
      requirements: {
        kind: 'group',
        operator: 'all',
        children: [
          grade('C6', 'ENGLISH'),
          grade('C6', 'CORE_MATHS'),
          {
            kind: 'rule',
            ruleType: 'subject_count',
            params: { count: 3, minGrade: 'C6', category: 'elective' },
          },
          {
            kind: 'rule',
            ruleType: 'manual_review',
            params: { description: 'Pass the entrance interview' },
          },
        ],
      } satisfies RequirementGroupInput,
    },
  },
];

const DEMO_SCHOLARSHIP_SLUGS = [
  'demo-merit-scholarship',
  'demo-women-in-stem-award',
  'demo-regional-bursary',
];
const DEMO_SOURCE_TITLE = 'Demo admissions brochure 2026/2027';

const day = (offset: number) => {
  const d = new Date(`${ghanaToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

export async function seedDemo({ db }: Database): Promise<{ created: boolean }> {
  const existing = await db
    .select({ id: universities.id })
    .from(universities)
    .where(
      inArray(
        universities.slug,
        DEMO_UNIVERSITIES.map((u) => u.slug),
      ),
    );
  if (existing.length > 0) return { created: false };

  await db.transaction(async (tx) => {
    const now = new Date();
    const [source] = await tx
      .insert(sources)
      .values({
        title: DEMO_SOURCE_TITLE,
        url: 'https://example.com/demo-brochure',
        publisher: 'Demo data',
        academicYear: '2026/2027',
        retrievedOn: ghanaToday(),
        notes: 'Fictional source for demo data.',
      })
      .returning();
    const verify = (
      entityType: 'university' | 'programme_admission_cycle' | 'scholarship_cycle',
      entityId: string,
    ) =>
      tx.insert(verificationRecords).values({
        entityType,
        entityId,
        sourceId: source!.id,
        status: 'verified',
        verifiedAt: now,
      });

    const universityIds: Record<string, string> = {};
    for (const { programme, ...uni } of DEMO_UNIVERSITIES) {
      const [u] = await tx
        .insert(universities)
        .values({ ...uni, status: 'published', publishedAt: now })
        .returning();
      universityIds[uni.slug] = u!.id;
      await verify('university', u!.id);

      const { requirements, ...programmeFields } = programme;
      const [p] = await tx
        .insert(programmes)
        .values({ ...programmeFields, universityId: u!.id, status: 'published', publishedAt: now })
        .returning();
      // Requirements can only be added while the cycle is a draft; then it is published.
      const [cycle] = await tx
        .insert(programmeAdmissionCycles)
        .values({
          programmeId: p!.id,
          academicYear: '2026/2027',
          applicationOpensOn: day(-14),
          applicationDeadline: day(60),
          applicationUrl: `${uni.websiteUrl}/apply`,
          notes: 'Demo data.',
        })
        .returning();
      await replaceRequirementTree(tx, cycle!.id, requirements);
      await verify('programme_admission_cycle', cycle!.id);
      await tx
        .update(programmeAdmissionCycles)
        .set({ status: 'published', verifiedAt: now, publishedAt: now })
        .where(eq(programmeAdmissionCycles.id, cycle!.id));
    }

    const demoScholarships = [
      {
        slug: 'demo-merit-scholarship',
        name: 'Demo Merit Scholarship',
        providerName: 'Demo Education Fund',
        providerUrl: 'https://fund.example.com',
        universityId: universityIds['demo-university-of-accra'],
        description: 'A fictional merit scholarship that is open now.',
        coverage: 'Full tuition and a monthly stipend',
        studyLevels: ['undergraduate' as const],
        fields: ['Computer Science', 'Engineering'],
        eligibilityCategories: ['Merit'],
        location: 'Ghana',
        status: 'published' as const,
        cycle: { opensOn: day(-10), closesOn: day(45) },
        requirements: [
          'Ghanaian citizen',
          'Aggregate of 12 or better in WASSCE',
          'Admitted to a public university',
        ],
      },
      {
        slug: 'demo-women-in-stem-award',
        name: 'Demo Women in STEM Award',
        providerName: 'Demo STEM Foundation',
        providerUrl: 'https://stem.example.com',
        universityId: null,
        description: 'A fictional award for women studying science and engineering. Opens soon.',
        coverage: 'GHS 10,000 per year',
        studyLevels: ['undergraduate' as const, 'diploma' as const],
        fields: ['Engineering', 'Computer Science'],
        eligibilityCategories: ['Female applicants'],
        location: 'Ghana',
        status: 'published' as const,
        cycle: { opensOn: day(20), closesOn: day(80) },
        requirements: ['Female applicant', 'Studying a science or engineering programme'],
      },
      {
        slug: 'demo-regional-bursary',
        name: 'Demo Regional Bursary',
        providerName: 'Demo Regional Council',
        providerUrl: 'https://council.example.com',
        universityId: universityIds['demo-technical-university-kumasi'],
        description: 'A fictional need-based bursary whose deadline has passed.',
        coverage: 'Partial tuition',
        studyLevels: ['diploma' as const, 'undergraduate' as const],
        fields: [],
        eligibilityCategories: ['Need-based'],
        location: 'Ashanti Region',
        status: 'expired' as const,
        cycle: { opensOn: day(-90), closesOn: day(-30) },
        requirements: ['Resident of the Ashanti Region', 'Evidence of financial need'],
      },
    ];

    for (const { cycle, requirements, ...fields } of demoScholarships) {
      const [s] = await tx
        .insert(scholarships)
        .values({ ...fields, publishedAt: now })
        .returning();
      const [c] = await tx
        .insert(scholarshipCycles)
        .values({
          scholarshipId: s!.id,
          academicYear: '2026/2027',
          ...cycle,
          applicationUrl: `${fields.providerUrl}/apply`,
        })
        .returning();
      await tx
        .insert(scholarshipRequirements)
        .values(
          requirements.map((description, i) => ({ cycleId: c!.id, description, sortOrder: i })),
        );
      await verify('scholarship_cycle', c!.id);
    }
  });

  return { created: true };
}

/**
 * Removes everything seedDemo created, and nothing else. Published demo
 * cycles are protected by the history triggers, so those triggers are
 * switched off only inside this transaction.
 */
export async function removeDemo({ db }: Database): Promise<{ removed: boolean }> {
  return db.transaction(async (tx) => {
    const unis = await tx
      .select({ id: universities.id })
      .from(universities)
      .where(
        inArray(
          universities.slug,
          DEMO_UNIVERSITIES.map((u) => u.slug),
        ),
      );
    const schols = await tx
      .select({ id: scholarships.id })
      .from(scholarships)
      .where(inArray(scholarships.slug, DEMO_SCHOLARSHIP_SLUGS));
    if (unis.length === 0 && schols.length === 0) return { removed: false };

    const uniIds = unis.map((u) => u.id);
    const progIds = uniIds.length
      ? (
          await tx
            .select({ id: programmes.id })
            .from(programmes)
            .where(inArray(programmes.universityId, uniIds))
        ).map((p) => p.id)
      : [];
    const cycleIds = progIds.length
      ? (
          await tx
            .select({ id: programmeAdmissionCycles.id })
            .from(programmeAdmissionCycles)
            .where(inArray(programmeAdmissionCycles.programmeId, progIds))
        ).map((c) => c.id)
      : [];
    const scholIds = schols.map((s) => s.id);
    const scholCycleIds = scholIds.length
      ? (
          await tx
            .select({ id: scholarshipCycles.id })
            .from(scholarshipCycles)
            .where(inArray(scholarshipCycles.scholarshipId, scholIds))
        ).map((c) => c.id)
      : [];

    const entityIds = [...uniIds, ...progIds, ...cycleIds, ...scholIds, ...scholCycleIds];
    if (entityIds.length) {
      await tx.delete(verificationRecords).where(inArray(verificationRecords.entityId, entityIds));
      await tx.delete(userReports).where(inArray(userReports.entityId, entityIds));
    }

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

    if (progIds.length) await tx.delete(programmes).where(inArray(programmes.id, progIds));
    if (scholIds.length) await tx.delete(scholarships).where(inArray(scholarships.id, scholIds));
    if (uniIds.length) await tx.delete(universities).where(inArray(universities.id, uniIds));
    await tx.delete(sources).where(eq(sources.title, DEMO_SOURCE_TITLE));
    return { removed: true };
  });
}
