import {
  type AdminDashboard,
  type AdminGrade,
  type AdminReport,
  type AdminSubject,
  ghanaToday,
  type ScholarshipDetail,
} from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../../db/client';
import {
  auditLogs,
  programmeAdmissionCycles,
  programmes,
  requirementGroups,
  requirementRules,
  universities,
  userReports,
} from '../../db/schema';
import { seed } from '../../db/seed/seed';
import { type ApiCall, signInTestAdmin } from '../../test/admin-session';

const database = getDatabase();
const { db } = database;
const app = createApp();
let api: ApiCall;
let sourceId: string;
let programmeId: string;

const day = (offset: number) => {
  const d = new Date(`${ghanaToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const report = (body: unknown, ip = '198.51.100.1') =>
  app.request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
    body: JSON.stringify(body),
  });

async function newScholarship(name: string, extra = {}) {
  const res = await api<{ id: string; slug: string }>('POST', '/api/admin/scholarships', {
    name,
    providerName: 'Ghana Education Trust',
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body;
}

const verifyCycle = (cycleId: string, verifiedAt?: string) =>
  api('POST', '/api/admin/verification', {
    entityType: 'scholarship_cycle',
    entityId: cycleId,
    sourceId,
    status: 'verified',
    ...(verifiedAt && { verifiedAt }),
  });

/** A scholarship with an open, verified cycle, published. */
async function publishedScholarship(name: string, closesOn = day(30), verifiedAt?: string) {
  const scholarship = await newScholarship(name);
  const cycle = await api<{ id: string }>(
    'POST',
    `/api/admin/scholarships/${scholarship.id}/cycles`,
    {
      academicYear: '2026/2027',
      opensOn: day(-5),
      closesOn,
      applicationUrl: 'https://apply.example.org',
    },
  );
  await verifyCycle(cycle.body.id, verifiedAt);
  expect(
    (await api('POST', `/api/admin/scholarships/${scholarship.id}/status`, { status: 'published' }))
      .status,
  ).toBe(200);
  return { ...scholarship, cycleId: cycle.body.id };
}

beforeAll(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
  await seed(database);
  ({ api } = await signInTestAdmin(app, db, 'catalogue-admin@example.com'));
  sourceId = (
    await api<{ id: string }>('POST', '/api/admin/sources', { title: 'Provider website' })
  ).body.id;

  // A published programme, and a draft cycle whose rule uses GEOGRAPHY at C5.
  const [uni] = await db
    .insert(universities)
    .values({
      slug: 'catalogue-uni',
      name: 'Catalogue University',
      institutionType: 'public_university',
      status: 'published',
    })
    .returning();
  const [programme] = await db
    .insert(programmes)
    .values({
      universityId: uni!.id,
      slug: 'ba-geography',
      name: 'BA Geography',
      degreeType: 'bachelor',
      status: 'published',
    })
    .returning();
  programmeId = programme!.id;
  const [cycle] = await db
    .insert(programmeAdmissionCycles)
    .values({ programmeId, academicYear: '2026/2027' })
    .returning();
  const [root] = await db
    .insert(requirementGroups)
    .values({ cycleId: cycle!.id, operator: 'all' })
    .returning();
  await db.insert(requirementRules).values({
    groupId: root!.id,
    ruleType: 'subject_grade',
    params: { subjectCodes: ['GEOGRAPHY'], minGrade: 'C5' },
  });
});

afterAll(async () => {
  await database.sql.end();
});

describe('scholarships', () => {
  it('can only be published with an open, sourced, verified cycle and an application link', async () => {
    const scholarship = await newScholarship('Merit Award', {
      fields: ['Engineering'],
      studyLevels: ['undergraduate'],
    });
    expect(scholarship.slug).toBe('merit-award');
    const publish = () =>
      api<{ error: string }>('POST', `/api/admin/scholarships/${scholarship.id}/status`, {
        status: 'published',
      });

    expect((await publish()).body.error).toMatch(/Add a cycle/);

    const closed = await api<{ id: string }>(
      'POST',
      `/api/admin/scholarships/${scholarship.id}/cycles`,
      {
        academicYear: '2025/2026',
        closesOn: day(-1),
      },
    );
    expect((await publish()).body.error).toMatch(/2025\/2026 cycle has closed/);

    const current = await api<{ id: string }>(
      'POST',
      `/api/admin/scholarships/${scholarship.id}/cycles`,
      {
        academicYear: '2026/2027',
        opensOn: day(-1),
        closesOn: day(60),
      },
    );
    expect((await publish()).body.error).toMatch(/application URL/);

    await api('PATCH', `/api/admin/scholarship-cycles/${current.body.id}`, {
      applicationUrl: 'https://apply.example.org',
    });
    expect((await publish()).body.error).toMatch(/Verify the 2026\/2027 cycle/);

    await verifyCycle(current.body.id);
    expect((await publish()).status).toBe(200);

    await api('PUT', `/api/admin/scholarship-cycles/${current.body.id}/requirements`, {
      requirements: [
        { description: 'Ghanaian citizen' },
        { description: 'Admitted to a public university' },
      ],
    });
    const publicView = (await (
      await app.request('/api/scholarships/merit-award')
    ).json()) as ScholarshipDetail;
    expect(publicView).toMatchObject({
      availability: 'open',
      academicYear: '2026/2027',
      requirements: ['Ghanaian citizen', 'Admitted to a public university'],
      verification: { source: { title: 'Provider website' } },
    });

    // History is kept once published.
    expect((await api('DELETE', `/api/admin/scholarship-cycles/${closed.body.id}`)).status).toBe(
      409,
    );
    expect(
      (
        await api('POST', `/api/admin/scholarships/${scholarship.id}/cycles`, {
          academicYear: '2026/2027',
        })
      ).status,
    ).toBe(409);
  });

  it('rejects unknown universities and invalid dates', async () => {
    expect(
      (
        await api('POST', '/api/admin/scholarships', {
          name: 'Orphan Award',
          providerName: 'Fund',
          universityId: '00000000-0000-4000-8000-000000000000',
        })
      ).status,
    ).toBe(400);
    const s = await newScholarship('Date Award');
    const cycle = await api<{ id: string }>('POST', `/api/admin/scholarships/${s.id}/cycles`, {
      academicYear: '2026/2027',
      opensOn: '2026-10-01',
      closesOn: '2026-11-01',
    });
    expect(
      (
        await api('PATCH', `/api/admin/scholarship-cycles/${cycle.body.id}`, {
          opensOn: '2026-12-01',
        })
      ).status,
    ).toBe(400);
    expect((await api('DELETE', `/api/admin/scholarship-cycles/${cycle.body.id}`)).status).toBe(
      204,
    );
  });

  it('expires published scholarships whose closing date has passed', async () => {
    const lapsed = await publishedScholarship('Lapsed Award');
    await api('PATCH', `/api/admin/scholarship-cycles/${lapsed.cycleId}`, {
      opensOn: day(-30),
      closesOn: day(-1),
    });

    // Already shown as closed publicly before any status change.
    const before = (await (
      await app.request('/api/scholarships/lapsed-award')
    ).json()) as ScholarshipDetail;
    expect(before.availability).toBe('closed');
    const dashboard = await api<AdminDashboard>('GET', '/api/admin/dashboard');
    expect(dashboard.body.scholarships.overdue).toBeGreaterThanOrEqual(1);

    const result = await api<{ expired: string[] }>(
      'POST',
      '/api/admin/scholarships/expire-overdue',
    );
    expect(result.body.expired).toContain('lapsed-award');
    const list = await api<{ items: { slug: string; status: string }[] }>(
      'GET',
      '/api/admin/scholarships?q=lapsed',
    );
    expect(list.body.items[0]).toMatchObject({ slug: 'lapsed-award', status: 'expired' });

    // It can return once a new, verified cycle is open.
    const republish = () =>
      api('POST', `/api/admin/scholarships/${lapsed.id}/status`, { status: 'published' });
    expect((await republish()).status).toBe(409);
    const next = await api<{ id: string }>('POST', `/api/admin/scholarships/${lapsed.id}/cycles`, {
      academicYear: '2027/2028',
      closesOn: day(90),
      applicationUrl: 'https://apply.example.org',
    });
    await verifyCycle(next.body.id);
    expect((await republish()).status).toBe(200);
  });

  it('flags published scholarships verified too long ago as stale', async () => {
    const old = await publishedScholarship(
      'Old Award',
      day(30),
      new Date(Date.now() - 400 * 86_400_000).toISOString(),
    );
    const stale = await api<{ items: { entityId: string; label: string }[] }>(
      'GET',
      '/api/admin/verification/stale',
    );
    expect(stale.body.items).toContainEqual(
      expect.objectContaining({ entityId: old.cycleId, label: 'Old Award (2026/2027)' }),
    );
  });
});

describe('subjects', () => {
  it('reports which subjects requirement rules use and protects them from deletion', async () => {
    const list = await api<AdminSubject[]>('GET', '/api/admin/subjects');
    expect(list.body.find((s) => s.code === 'GEOGRAPHY')?.usedByRules).toBe(1);
    expect(list.body.find((s) => s.code === 'BASKETRY')?.usedByRules).toBe(0);

    const blocked = await api<{ error: string }>('DELETE', '/api/admin/subjects/GEOGRAPHY');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/deactivate it instead/);
  });

  it('creates, edits, deactivates and deletes unused subjects', async () => {
    const created = await api('POST', '/api/admin/subjects', {
      code: 'FURTHER_MATHS',
      name: 'Further Mathematics (Test)',
      category: 'elective',
      aliases: ['FM', 'FM'],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ aliases: ['FM'], isActive: true });
    expect(
      (
        await api('POST', '/api/admin/subjects', {
          code: 'FURTHER_MATHS',
          name: 'Other',
          category: 'core',
        })
      ).status,
    ).toBe(409);
    expect((await api('PATCH', '/api/admin/subjects/FURTHER_MATHS', { code: 'FM' })).status).toBe(
      400,
    );

    await api('PATCH', '/api/admin/subjects/FURTHER_MATHS', { isActive: false });
    const publicSubjects = (await (await app.request('/api/subjects')).json()) as {
      code: string;
      isActive: boolean;
    }[];
    expect(publicSubjects.find((s) => s.code === 'FURTHER_MATHS')?.isActive).toBe(false);

    expect((await api('DELETE', '/api/admin/subjects/FURTHER_MATHS')).status).toBe(204);
    const actions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, 'FURTHER_MATHS'))
      .orderBy(auditLogs.id);
    expect(actions.map((a) => a.action)).toEqual([
      'subject.create',
      'subject.update',
      'subject.delete',
    ]);
  });
});

describe('grades', () => {
  const seedOrder = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

  it('adds, reorders and deletes grades, protecting those rules use', async () => {
    const created = await api<AdminGrade>('POST', '/api/admin/grades', {
      code: 'X1',
      label: 'Test',
      isPass: false,
    });
    expect(created.body).toMatchObject({ code: 'X1', rank: 10 });

    expect((await api('PUT', '/api/admin/grades/order', { codes: seedOrder })).status).toBe(400);
    await api('PUT', '/api/admin/grades/order', { codes: ['X1', ...seedOrder] });
    let grades = await api<AdminGrade[]>('GET', '/api/admin/grades');
    expect(grades.body.map((g) => g.code)).toEqual(['X1', ...seedOrder]);
    expect(grades.body.find((g) => g.code === 'C5')?.usedByRules).toBe(1);

    expect((await api('DELETE', '/api/admin/grades/C5')).status).toBe(409);
    await api('PUT', '/api/admin/grades/order', { codes: [...seedOrder, 'X1'] });
    expect((await api('DELETE', '/api/admin/grades/X1')).status).toBe(204);

    grades = await api<AdminGrade[]>('GET', '/api/admin/grades');
    expect(grades.body.map((g) => [g.code, g.rank])).toEqual(
      seedOrder.map((code, i) => [code, i + 1]),
    );
  });
});

describe('user reports', () => {
  it('accepts reports about public pages only, without contact details', async () => {
    const message = 'The application deadline shown is out of date.';
    expect((await report({ entityType: 'programme', entityId: programmeId, message })).status).toBe(
      201,
    );
    expect(
      (await report({ entityType: 'university', slug: 'catalogue-uni', message })).status,
    ).toBe(201);
    expect((await report({ entityType: 'university', slug: 'no-such-uni', message })).status).toBe(
      404,
    );
    expect(
      (
        await report({
          entityType: 'scholarship',
          slug: 'merit-award',
          message,
          phone: '0244000000',
        })
      ).status,
    ).toBe(400);

    const [stored] = await db
      .select()
      .from(userReports)
      .where(eq(userReports.entityId, programmeId));
    expect(Object.keys(stored!).sort()).toEqual([
      'adminNotes',
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'message',
      'resolvedAt',
      'resolvedBy',
      'status',
      'updatedAt',
    ]);
  });

  it('rate-limits reports per IP', async () => {
    const body = {
      entityType: 'university',
      slug: 'catalogue-uni',
      message: 'Something here is wrong.',
    };
    for (let i = 0; i < 5; i++) expect((await report(body, '198.51.100.99')).status).toBe(201);
    expect((await report(body, '198.51.100.99')).status).toBe(429);
  });

  it('lets admins triage reports, recording who resolved them', async () => {
    const list = await api<{ items: AdminReport[] }>(
      'GET',
      '/api/admin/reports?status=open&entityType=programme',
    );
    const item = list.body.items[0]!;
    expect(item.entityLabel).toBe('BA Geography, Catalogue University');

    const setStatus = (status: string, adminNotes?: string) =>
      api<AdminReport>('POST', `/api/admin/reports/${item.id}/status`, {
        status,
        ...(adminNotes && { adminNotes }),
      });

    expect((await setStatus('under_review')).body.status).toBe('under_review');
    const resolved = await setStatus('resolved', 'Deadline corrected in a new cycle version.');
    expect(resolved.body).toMatchObject({
      status: 'resolved',
      adminNotes: 'Deadline corrected in a new cycle version.',
      resolvedBy: { name: 'Test Admin' },
    });
    expect((await setStatus('under_review')).status).toBe(409);
    expect((await setStatus('open')).body).toMatchObject({
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
    });

    const actions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, item.id));
    expect(actions).toHaveLength(3);
  });
});

describe('dashboard', () => {
  it('summarises records by status', async () => {
    const { status, body } = await api<AdminDashboard>('GET', '/api/admin/dashboard');
    expect(status).toBe(200);
    expect(body.universities.published).toBeGreaterThanOrEqual(1);
    expect(body.programmes.published).toBeGreaterThanOrEqual(1);
    expect(body.scholarships.published).toBeGreaterThanOrEqual(1);
    expect(body.openReports).toBeGreaterThanOrEqual(6);
    expect(body.mentors).toEqual({ active: 0, inactive: 0, archived: 0 });
    expect(body.staleRecords).toBeGreaterThanOrEqual(1);
  });
});
