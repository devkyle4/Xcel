import {
  type EligibilityBundle,
  evaluateEligibility,
  ghanaToday,
  type Paginated,
  type ProgrammeDetail,
  type ProgrammeSummary,
  type ScholarshipDetail,
  type ScholarshipSummary,
  type UniversityDetail,
  type UniversitySummary,
} from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase } from '../db/client';
import {
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  requirementRules,
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  sources,
  universities,
  verificationRecords,
} from '../db/schema';
import { seed } from '../db/seed/seed';

const database = getDatabase();
const { db } = database;
const app = createApp();

async function get<T>(path: string, init?: RequestInit) {
  const res = await app.request(path, init);
  return { res, body: (res.status === 304 ? null : await res.json()) as T };
}

const day = (offset: number) => {
  const d = new Date(`${ghanaToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Creates a cycle whose requirements are "all of" the given subject/grade pairs. */
async function cycleWithRequirements(
  programmeId: string,
  academicYear: string,
  status: 'published' | 'draft',
  requirements: [string, string][],
) {
  const [cycle] = await db
    .insert(programmeAdmissionCycles)
    .values({
      programmeId,
      academicYear,
      // Requirements can only be added while a cycle is a draft; status is set below.
      status: 'draft',
      applicationDeadline: day(60),
      applicationUrl: 'https://apply.example.edu',
    })
    .returning();
  const [root] = await db
    .insert(requirementGroups)
    .values({ cycleId: cycle!.id, operator: 'all' })
    .returning();
  await db.insert(requirementRules).values(
    requirements.map(([subject, minGrade], i) => ({
      groupId: root!.id,
      ruleType: 'subject_grade',
      params: { subjectCodes: [subject], minGrade },
      sortOrder: i,
    })),
  );
  if (status === 'published') {
    await db
      .update(programmeAdmissionCycles)
      .set({ status, publishedAt: new Date() })
      .where(eq(programmeAdmissionCycles.id, cycle!.id));
  }
  return cycle!;
}

const ids: Record<string, string> = {};

beforeAll(async () => {
  await db.execute(
    sql`TRUNCATE universities, programmes, programme_admission_cycles, scholarships, sources, verification_records CASCADE`,
  );
  await seed(database);

  const [ug, knust, hidden] = await db
    .insert(universities)
    .values([
      {
        slug: 'university-of-ghana',
        name: 'University of Ghana',
        shortName: 'UG',
        institutionType: 'public_university',
        region: 'greater_accra',
        town: 'Legon',
        status: 'published',
      },
      {
        slug: 'knust',
        name: 'Kwame Nkrumah University of Science and Technology',
        shortName: 'KNUST',
        institutionType: 'public_university',
        region: 'ashanti',
        town: 'Kumasi',
        status: 'published',
      },
      {
        slug: 'hidden-university',
        name: 'Hidden University',
        institutionType: 'private_university',
        status: 'draft',
      },
    ])
    .returning();
  ids.knust = knust!.id;

  const [engineering, economics, nursing, hiddenProgramme] = await db
    .insert(programmes)
    .values([
      {
        universityId: knust!.id,
        slug: 'bsc-computer-engineering',
        name: 'BSc Computer Engineering',
        field: 'Engineering',
        degreeType: 'bachelor',
        durationYears: 4,
        status: 'published',
      },
      {
        universityId: ug!.id,
        slug: 'ba-economics',
        name: 'BA Economics',
        field: 'Social Sciences',
        degreeType: 'bachelor',
        status: 'published',
      },
      {
        universityId: ug!.id,
        slug: 'bsc-nursing',
        name: 'BSc Nursing',
        degreeType: 'bachelor',
        status: 'draft',
      },
      {
        universityId: hidden!.id,
        slug: 'bsc-secret',
        name: 'BSc Secret Studies',
        degreeType: 'bachelor',
        status: 'published',
      },
    ])
    .returning();
  ids.engineering = engineering!.id;
  ids.nursing = nursing!.id;
  ids.hiddenProgramme = hiddenProgramme!.id;

  await cycleWithRequirements(engineering!.id, '2025/2026', 'published', [['PHYSICS', 'C6']]);
  const current = await cycleWithRequirements(engineering!.id, '2026/2027', 'published', [
    ['PHYSICS', 'B3'],
    ['ELECTIVE_MATHS', 'C6'],
  ]);
  await cycleWithRequirements(engineering!.id, '2027/2028', 'draft', [['PHYSICS', 'A1']]);
  await cycleWithRequirements(economics!.id, '2026/2027', 'draft', [['ECONOMICS', 'C6']]);
  await cycleWithRequirements(hiddenProgramme!.id, '2026/2027', 'published', [['ENGLISH', 'F9']]);

  const [source] = await db
    .insert(sources)
    .values({
      title: 'KNUST Admission Requirements 2026/2027',
      url: 'https://knust.edu.gh/admissions',
      academicYear: '2026/2027',
    })
    .returning();
  await db.insert(verificationRecords).values({
    entityType: 'programme_admission_cycle',
    entityId: current.id,
    sourceId: source!.id,
    status: 'verified',
    verifiedAt: new Date('2026-09-01T10:00:00Z'),
  });

  const scholarshipRows = await db
    .insert(scholarships)
    .values([
      {
        slug: 'mastercard-scholars',
        name: 'Scholars Programme',
        providerName: 'Mastercard Foundation',
        universityId: knust!.id,
        studyLevels: ['undergraduate'],
        fields: ['Engineering'],
        eligibilityCategories: ['Need-based'],
        location: 'Ghana',
        status: 'published',
      },
      {
        slug: 'upcoming-award',
        name: 'Upcoming Award',
        providerName: 'Fund A',
        status: 'published',
      },
      { slug: 'closed-award', name: 'Closed Award', providerName: 'Fund B', status: 'published' },
      { slug: 'expired-award', name: 'Expired Award', providerName: 'Fund C', status: 'expired' },
      { slug: 'undated-award', name: 'Undated Award', providerName: 'Fund D', status: 'published' },
      { slug: 'draft-award', name: 'Draft Award', providerName: 'Fund E', status: 'draft' },
    ])
    .returning();
  const bySlug = Object.fromEntries(scholarshipRows.map((s) => [s.slug, s.id]));

  const cycles = await db
    .insert(scholarshipCycles)
    .values([
      {
        scholarshipId: bySlug['mastercard-scholars']!,
        academicYear: '2026/2027',
        opensOn: day(-10),
        closesOn: day(30),
        applicationUrl: 'https://apply.example.org',
      },
      // An older cycle must not be treated as current.
      {
        scholarshipId: bySlug['mastercard-scholars']!,
        academicYear: '2025/2026',
        opensOn: day(-400),
        closesOn: day(-300),
      },
      {
        scholarshipId: bySlug['upcoming-award']!,
        academicYear: '2026/2027',
        opensOn: day(10),
        closesOn: day(60),
      },
      { scholarshipId: bySlug['closed-award']!, academicYear: '2026/2027', closesOn: day(-1) },
      { scholarshipId: bySlug['expired-award']!, academicYear: '2026/2027', closesOn: day(90) },
      { scholarshipId: bySlug['draft-award']!, academicYear: '2026/2027', closesOn: day(90) },
    ])
    .returning();
  await db.insert(scholarshipRequirements).values([
    { cycleId: cycles[0]!.id, description: 'Ghanaian citizen', sortOrder: 1 },
    { cycleId: cycles[0]!.id, description: 'Admitted to a partner university', sortOrder: 0 },
  ]);
});

afterAll(async () => {
  await database.sql.end();
});

describe('GET /api/subjects and /api/grades', () => {
  it('lists active subjects and grades in rank order, cacheably', async () => {
    const subjects = await get<{ code: string }[]>('/api/subjects');
    expect(subjects.body.map((s) => s.code)).toContain('ENGLISH');
    expect(subjects.res.headers.get('cache-control')).toContain('s-maxage=300');

    const grades = await get<{ code: string }[]>('/api/grades');
    expect(grades.body.map((g) => g.code)).toEqual([
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
});

describe('GET /api/universities', () => {
  it('lists only published universities', async () => {
    const { body } = await get<Paginated<UniversitySummary>>('/api/universities');
    expect(body.items.map((u) => u.slug)).toEqual(['knust', 'university-of-ghana']);
    expect(body.total).toBe(2);
  });

  it.each(['Kwame Nkrumah', 'Kwame Nkruma', 'KNUST', 'technology'])(
    'finds KNUST by "%s"',
    async (q) => {
      const { body } = await get<Paginated<UniversitySummary>>(
        `/api/universities?q=${encodeURIComponent(q)}`,
      );
      expect(body.items[0]?.slug).toBe('knust');
    },
  );

  it('filters by region and paginates', async () => {
    const byRegion = await get<Paginated<UniversitySummary>>('/api/universities?region=ashanti');
    expect(byRegion.body.items.map((u) => u.slug)).toEqual(['knust']);

    const page2 = await get<Paginated<UniversitySummary>>('/api/universities?page=2&pageSize=1');
    expect(page2.body).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(page2.body.items.map((u) => u.slug)).toEqual(['university-of-ghana']);
  });

  it('shows a university with its public programmes and scholarships', async () => {
    const { body } = await get<UniversityDetail>('/api/universities/university-of-ghana');
    expect(body.programmes.map((p) => p.name)).toEqual(['BA Economics']);

    const knust = await get<UniversityDetail>('/api/universities/knust');
    expect(knust.body.scholarships.map((s) => s.slug)).toEqual(['mastercard-scholars']);
  });

  it('hides unpublished universities', async () => {
    expect((await app.request('/api/universities/hidden-university')).status).toBe(404);
  });
});

describe('GET /api/programmes', () => {
  it('lists only programmes that are published at published universities', async () => {
    const { body, res } = await get<Paginated<ProgrammeSummary>>('/api/programmes');
    expect(body.items.map((p) => p.name)).toEqual(['BSc Computer Engineering', 'BA Economics']);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
  });

  it('shows the latest published admission year, or null if none is published', async () => {
    const { body } = await get<Paginated<ProgrammeSummary>>('/api/programmes');
    expect(body.items.map((p) => [p.name, p.academicYear, p.university.slug])).toEqual([
      ['BSc Computer Engineering', '2026/2027', 'knust'],
      ['BA Economics', null, 'university-of-ghana'],
    ]);
  });

  it.each([
    ['university=knust', ['BSc Computer Engineering']],
    ['field=engineering', ['BSc Computer Engineering']],
    ['region=greater_accra', ['BA Economics']],
    ['degreeType=diploma', []],
    ['q=enginering', ['BSc Computer Engineering']],
    ['q=economic&university=knust', []],
  ])('filters with %s', async (query, expected) => {
    const { body } = await get<Paginated<ProgrammeSummary>>(`/api/programmes?${query}`);
    expect(body.items.map((p) => p.name)).toEqual(expected);
    expect(body.total).toBe(expected.length);
  });

  it('rejects invalid query parameters with details', async () => {
    const { res, body } = await get<{ error: string; issues: { path: string }[] }>(
      '/api/programmes?pageSize=500&region=mars',
    );
    expect(res.status).toBe(400);
    expect(body.issues.map((i) => i.path).sort()).toEqual(['pageSize', 'region']);
  });
});

describe('GET /api/programmes/:id', () => {
  it('shows the latest published cycle with its requirements and verification', async () => {
    const { body } = await get<ProgrammeDetail>(`/api/programmes/${ids.engineering}`);
    expect(body.availableYears).toEqual(['2026/2027', '2025/2026']);
    expect(body.cycle).toMatchObject({
      academicYear: '2026/2027',
      applicationUrl: 'https://apply.example.edu',
      verification: {
        verifiedAt: '2026-09-01T10:00:00.000Z',
        source: { url: 'https://knust.edu.gh/admissions', academicYear: '2026/2027' },
      },
    });
    expect(body.cycle!.requirements).toMatchObject({
      kind: 'group',
      operator: 'all',
      children: [
        {
          kind: 'rule',
          ruleType: 'subject_grade',
          params: { subjectCodes: ['PHYSICS'], minGrade: 'B3' },
        },
        { kind: 'rule', params: { subjectCodes: ['ELECTIVE_MATHS'], minGrade: 'C6' } },
      ],
    });
  });

  it('shows an earlier published year on request', async () => {
    const { body } = await get<ProgrammeDetail>(
      `/api/programmes/${ids.engineering}?year=2025/2026`,
    );
    expect(body.cycle?.academicYear).toBe('2025/2026');
    expect(body.cycle?.requirements?.children).toHaveLength(1);
    expect(body.cycle?.verification).toBeNull();
  });

  it('does not show draft cycles', async () => {
    const res = await app.request(`/api/programmes/${ids.engineering}?year=2027/2028`);
    expect(res.status).toBe(404);
  });

  it.each([
    ['a draft programme', () => ids.nursing],
    ['a programme at an unpublished university', () => ids.hiddenProgramme],
    ['a malformed id', () => 'not-a-uuid'],
    ['an unknown id', () => '00000000-0000-0000-0000-000000000000'],
  ])('returns 404 for %s', async (_, id) => {
    expect((await app.request(`/api/programmes/${id()}`)).status).toBe(404);
  });
});

describe('GET /api/scholarships', () => {
  it('lists public scholarships, open first, never showing expired ones as open', async () => {
    const { body } = await get<Paginated<ScholarshipSummary>>('/api/scholarships');
    expect(body.items.map((s) => [s.slug, s.availability])).toEqual([
      ['mastercard-scholars', 'open'],
      ['upcoming-award', 'upcoming'],
      ['undated-award', 'unknown'],
      ['closed-award', 'closed'],
      ['expired-award', 'closed'],
    ]);
  });

  it('uses the current cycle, not an older one', async () => {
    const { body } = await get<Paginated<ScholarshipSummary>>('/api/scholarships?q=mastercard');
    expect(body.items[0]).toMatchObject({ academicYear: '2026/2027', closesOn: day(30) });
  });

  it.each([
    ['availability=open,upcoming', ['mastercard-scholars', 'upcoming-award']],
    ['availability=closed', ['closed-award', 'expired-award']],
    ['studyLevel=undergraduate', ['mastercard-scholars']],
    ['field=ENGINEERING', ['mastercard-scholars']],
    ['category=need-based', ['mastercard-scholars']],
    ['location=ghan', ['mastercard-scholars']],
    ['q=Mastercard Foundation', ['mastercard-scholars']],
    ['q=Draft', []],
  ])('filters with %s', async (query, expected) => {
    const { body } = await get<Paginated<ScholarshipSummary>>(
      `/api/scholarships?${query.replace(' ', '%20')}`,
    );
    expect(body.items.map((s) => s.slug)).toEqual(expected);
    expect(body.total).toBe(expected.length);
  });

  it('shows scholarship details with requirements in order', async () => {
    const { body } = await get<ScholarshipDetail>('/api/scholarships/mastercard-scholars');
    expect(body).toMatchObject({
      availability: 'open',
      applicationUrl: 'https://apply.example.org',
      university: { slug: 'knust' },
      requirements: ['Admitted to a partner university', 'Ghanaian citizen'],
      verification: null,
    });
  });

  it('shows an expired scholarship as closed and hides drafts', async () => {
    const expired = await get<ScholarshipDetail>('/api/scholarships/expired-award');
    expect(expired.body.availability).toBe('closed');
    expect((await app.request('/api/scholarships/draft-award')).status).toBe(404);
  });
});

describe('GET /api/eligibility/requirements', () => {
  it('serves the catalogue and current published requirements only', async () => {
    const { body, res } = await get<EligibilityBundle>('/api/eligibility/requirements');
    expect(body.catalogue.grades).toHaveLength(9);
    expect(body.programmes.map((p) => [p.name, p.academicYear])).toEqual([
      ['BSc Computer Engineering', '2026/2027'],
    ]);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    expect(res.headers.get('etag')).toBeTruthy();
  });

  it('answers 304 when the browser already has the current version', async () => {
    const first = await app.request('/api/eligibility/requirements');
    const again = await app.request('/api/eligibility/requirements', {
      headers: { 'If-None-Match': first.headers.get('etag')! },
    });
    expect(again.status).toBe(304);
  });

  it('is enough for the browser to evaluate eligibility locally', async () => {
    const { body } = await get<EligibilityBundle>('/api/eligibility/requirements');
    const programme = body.programmes[0]!;
    const check = (results: Record<string, string>) =>
      evaluateEligibility(programme.requirements, results, body.catalogue).status;

    expect(check({ PHYSICS: 'B3', ELECTIVE_MATHS: 'C6' })).toBe('Eligible');
    expect(check({ PHYSICS: 'C4', ELECTIVE_MATHS: 'C6' })).toBe('NotEligible');
  });

  it('has no endpoint that accepts student results', async () => {
    for (const path of [
      '/api/eligibility/check',
      `/api/programmes/${ids.engineering}/eligibility`,
    ]) {
      const res = await app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PHYSICS: 'A1' }),
      });
      expect(res.status).toBe(404);
    }
  });
});
