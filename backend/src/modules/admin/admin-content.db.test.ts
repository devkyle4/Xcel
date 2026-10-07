import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../../db/client';
import { auditLogs, programmeAdmissionCycles } from '../../db/schema';
import { createAdminUser } from './users';

const database = getDatabase();
const { db } = database;
const app = createApp();

let cookie = '';
let adminId = '';

type Json = Record<string, unknown>;

/** Calls the API as the signed-in admin (or anonymously), returning status and JSON body. */
async function api<T = Json>(method: string, path: string, body?: unknown, auth = true) {
  const res = await app.request(path, {
    method,
    headers: {
      ...(auth && { Cookie: cookie }),
      Origin: 'http://localhost',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const auditActions = async (entityId: string) =>
  (
    await db
      .select({ action: auditLogs.action, actor: auditLogs.actorUserId })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, entityId))
      .orderBy(auditLogs.id)
  ).map((r) => r.action);

const newUniversity = (name: string, extra: Json = {}) =>
  api<Json & { id: string; slug: string; status: string }>('POST', '/api/admin/universities', {
    name,
    institutionType: 'public_university',
    ...extra,
  });

/** Moves a university to published via a verified source, as an admin would. */
async function publishUniversity(id: string) {
  const source = await api<{ id: string }>('POST', '/api/admin/sources', {
    title: 'Official site',
  });
  await api('POST', '/api/admin/verification', {
    entityType: 'university',
    entityId: id,
    sourceId: source.body.id,
    status: 'verified',
  });
  for (const status of ['needs_verification', 'verified', 'published']) {
    expect((await api('POST', `/api/admin/universities/${id}/status`, { status })).status).toBe(
      200,
    );
  }
}

beforeAll(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
  ({ id: adminId } = await createAdminUser(
    db,
    { email: 'content-admin@example.com', name: 'Kofi Content', password: 'content-password-1' },
    null,
    { N: 2 ** 10, r: 8, p: 1 },
  ));
  const res = await app.request('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'content-admin@example.com', password: 'content-password-1' }),
  });
  cookie = res.headers.get('set-cookie')!.split(';')[0]!;
});

afterAll(async () => {
  await database.sql.end();
});

describe('authorization', () => {
  it.each([
    ['GET', '/api/admin/universities'],
    ['POST', '/api/admin/universities'],
    ['GET', '/api/admin/programmes'],
    ['POST', '/api/admin/sources'],
    ['POST', '/api/admin/verification'],
    ['GET', '/api/admin/verification/stale'],
    ['PATCH', '/api/admin/settings'],
  ])('%s %s requires an admin session', async (method, path) => {
    expect((await api(method, path, method === 'GET' ? undefined : {}, false)).status).toBe(401);
  });
});

describe('universities', () => {
  it('creates a draft with a generated, unique slug and audits it', async () => {
    const first = await newUniversity('Test University', { region: 'volta' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ slug: 'test-university', status: 'draft', region: 'volta' });
    expect(first.body).not.toHaveProperty('searchVector');

    const second = await newUniversity('Test University');
    expect(second.body.slug).toBe('test-university-2');

    expect(await auditActions(first.body.id)).toEqual(['university.create']);
    const [entry] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, first.body.id), eq(auditLogs.action, 'university.create')));
    expect(entry).toMatchObject({ actorUserId: adminId, after: { name: 'Test University' } });
  });

  it('rejects a duplicate explicit slug and invalid input', async () => {
    await newUniversity('Slug Owner', { slug: 'taken-slug' });
    expect((await newUniversity('Other', { slug: 'taken-slug' })).status).toBe(409);
    expect((await newUniversity('Bad Link', { websiteUrl: 'javascript:alert(1)' })).status).toBe(
      400,
    );
    expect((await newUniversity('X')).status).toBe(400);
  });

  it('lists drafts for admins, with status and search filters', async () => {
    await newUniversity('Searchable Polytechnic');
    const { body } = await api<{ items: { name: string; status: string }[] }>(
      'GET',
      '/api/admin/universities?status=draft&q=polytechnic',
    );
    expect(body.items.map((u) => u.name)).toEqual(['Searchable Polytechnic']);
  });

  it('updates fields, clears them with null, and records before and after', async () => {
    const { body: uni } = await newUniversity('Editable University', { town: 'Ho' });
    const updated = await api('PATCH', `/api/admin/universities/${uni.id}`, {
      town: null,
      shortName: 'EU',
    });
    expect(updated.body).toMatchObject({
      town: null,
      shortName: 'EU',
      name: 'Editable University',
    });

    const [entry] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, uni.id), eq(auditLogs.action, 'university.update')));
    expect(entry).toMatchObject({ before: { town: 'Ho' }, after: { town: null, shortName: 'EU' } });

    expect((await api('PATCH', `/api/admin/universities/${uni.id}`, {})).status).toBe(400);
    expect(
      (await api('PATCH', `/api/admin/universities/${uni.id}`, { status: 'published' })).status,
    ).toBe(400);
    expect(
      (
        await api('PATCH', '/api/admin/universities/00000000-0000-0000-0000-000000000000', {
          town: 'X',
        })
      ).status,
    ).toBe(404);
  });

  it('follows the publishing workflow and requires verification before Verified', async () => {
    const { body: uni } = await newUniversity('Workflow University');
    const setStatus = (status: string) =>
      api<{ status: string; publishedAt: string | null; archivedAt: string | null }>(
        'POST',
        `/api/admin/universities/${uni.id}/status`,
        { status },
      );

    expect((await setStatus('published')).status).toBe(409);
    expect((await setStatus('needs_verification')).status).toBe(200);
    const unverified = await setStatus('verified');
    expect(unverified.status).toBe(409);
    expect(unverified.body).toMatchObject({ error: expect.stringMatching(/verification record/) });

    const source = await api<{ id: string }>('POST', '/api/admin/sources', {
      title: 'Workflow University website',
      url: 'https://workflow.example.edu',
    });
    expect(
      (
        await api('POST', '/api/admin/verification', {
          entityType: 'university',
          entityId: uni.id,
          sourceId: source.body.id,
          status: 'verified',
        })
      ).status,
    ).toBe(201);
    expect((await setStatus('verified')).status).toBe(200);

    const published = await setStatus('published');
    expect(published.body.publishedAt).not.toBeNull();
    expect((await app.request(`/api/universities/${uni.slug}`)).status).toBe(200);

    await setStatus('unpublished');
    expect((await app.request(`/api/universities/${uni.slug}`)).status).toBe(404);

    expect((await setStatus('archived')).body.archivedAt).not.toBeNull();
    expect((await setStatus('draft')).body.archivedAt).toBeNull();

    expect(await auditActions(uni.id)).toEqual([
      'university.create',
      'university.status',
      'verification.create',
      'university.status',
      'university.status',
      'university.status',
      'university.status',
      'university.status',
    ]);
  });
});

describe('faculties and schools', () => {
  it('can be created, renamed and deleted only when unused', async () => {
    const { body: uni } = await newUniversity('Faculty University');
    const faculty = await api<{ id: string }>(
      'POST',
      `/api/admin/universities/${uni.id}/faculty-schools`,
      {
        name: 'Faculty of Engineering',
      },
    );
    expect(faculty.status).toBe(201);
    expect(
      (
        await api('POST', `/api/admin/universities/${uni.id}/faculty-schools`, {
          name: 'Faculty of Engineering',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api('PATCH', `/api/admin/faculty-schools/${faculty.body.id}`, {
          name: 'College of Engineering',
        })
      ).body,
    ).toMatchObject({ name: 'College of Engineering' });

    const programme = await api<{ id: string }>('POST', '/api/admin/programmes', {
      universityId: uni.id,
      facultySchoolId: faculty.body.id,
      name: 'BSc Civil Engineering',
      degreeType: 'bachelor',
    });
    expect((await api('DELETE', `/api/admin/faculty-schools/${faculty.body.id}`)).status).toBe(409);

    await api('PATCH', `/api/admin/programmes/${programme.body.id}`, { facultySchoolId: null });
    expect((await api('DELETE', `/api/admin/faculty-schools/${faculty.body.id}`)).status).toBe(204);
    expect(await auditActions(faculty.body.id)).toEqual([
      'faculty_school.create',
      'faculty_school.update',
      'faculty_school.delete',
    ]);
  });
});

describe('programmes', () => {
  it('creates programmes with slugs unique per university', async () => {
    const { body: a } = await newUniversity('Programme University A');
    const { body: b } = await newUniversity('Programme University B');
    const create = (universityId: string) =>
      api<{ slug: string; status: string }>('POST', '/api/admin/programmes', {
        universityId,
        name: 'BSc Nursing',
        degreeType: 'bachelor',
        durationYears: 4,
      });

    expect((await create(a.id)).body).toMatchObject({ slug: 'bsc-nursing', status: 'draft' });
    expect((await create(a.id)).body.slug).toBe('bsc-nursing-2');
    expect((await create(b.id)).body.slug).toBe('bsc-nursing');
  });

  it('rejects a faculty from another university and an unknown university', async () => {
    const { body: a } = await newUniversity('Faculty Check A');
    const { body: b } = await newUniversity('Faculty Check B');
    const facultyOfB = await api<{ id: string }>(
      'POST',
      `/api/admin/universities/${b.id}/faculty-schools`,
      {
        name: 'School of Law',
      },
    );
    const res = await api<{ issues: { path: string }[] }>('POST', '/api/admin/programmes', {
      universityId: a.id,
      facultySchoolId: facultyOfB.body.id,
      name: 'LLB Law',
      degreeType: 'bachelor',
    });
    expect(res.status).toBe(400);
    expect(res.body.issues[0]?.path).toBe('facultySchoolId');

    expect(
      (
        await api('POST', '/api/admin/programmes', {
          universityId: '00000000-0000-4000-8000-000000000000',
          name: 'Orphan',
          degreeType: 'bachelor',
        })
      ).status,
    ).toBe(400);
  });

  it('cannot move a programme to another university', async () => {
    const { body: uni } = await newUniversity('Fixed University');
    const programme = await api<{ id: string }>('POST', '/api/admin/programmes', {
      universityId: uni.id,
      name: 'BA History',
      degreeType: 'bachelor',
    });
    expect(
      (await api('PATCH', `/api/admin/programmes/${programme.body.id}`, { universityId: uni.id }))
        .status,
    ).toBe(400);
  });

  it('publishes through the workflow and appears publicly once its university is published', async () => {
    const { body: uni } = await newUniversity('Public Programme University');
    const programme = await api<{ id: string }>('POST', '/api/admin/programmes', {
      universityId: uni.id,
      name: 'BSc Agriculture',
      degreeType: 'bachelor',
    });
    for (const status of ['needs_verification', 'verified', 'published']) {
      expect(
        (await api('POST', `/api/admin/programmes/${programme.body.id}/status`, { status })).status,
      ).toBe(200);
    }
    expect((await app.request(`/api/programmes/${programme.body.id}`)).status).toBe(404);

    await publishUniversity(uni.id);
    expect((await app.request(`/api/programmes/${programme.body.id}`)).status).toBe(200);

    const detail = await api<{ university: { name: string }; admissionCycles: unknown[] }>(
      'GET',
      `/api/admin/programmes/${programme.body.id}`,
    );
    expect(detail.body).toMatchObject({
      university: { name: 'Public Programme University' },
      admissionCycles: [],
    });
  });
});

describe('sources and verification', () => {
  it('validates sources', async () => {
    expect(
      (await api('POST', '/api/admin/sources', { title: 'Brochure', academicYear: '2026-2027' }))
        .status,
    ).toBe(400);
    expect(
      (await api('POST', '/api/admin/sources', { title: 'Brochure', url: 'javascript:x' })).status,
    ).toBe(400);

    const created = await api<{ id: string; createdBy: string }>('POST', '/api/admin/sources', {
      title: 'Admissions Brochure 2026/2027',
      academicYear: '2026/2027',
      retrievedOn: '2026-09-15',
    });
    expect(created.body.createdBy).toBe(adminId);
    expect(
      (await api('PATCH', `/api/admin/sources/${created.body.id}`, { publisher: 'Registry' })).body,
    ).toMatchObject({
      publisher: 'Registry',
    });
    const list = await api<{ items: { title: string }[] }>('GET', '/api/admin/sources?q=brochure');
    expect(list.body.items.map((s) => s.title)).toContain('Admissions Brochure 2026/2027');
  });

  it('records verification history with the verifier and source', async () => {
    const { body: uni } = await newUniversity('History University');
    expect(
      (
        await api('POST', '/api/admin/verification', {
          entityType: 'university',
          entityId: '00000000-0000-4000-8000-000000000000',
          status: 'pending',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('POST', '/api/admin/verification', {
          entityType: 'university',
          entityId: uni.id,
          status: 'verified',
        })
      ).status,
    ).toBe(400);

    await api('POST', '/api/admin/verification', {
      entityType: 'university',
      entityId: uni.id,
      status: 'rejected',
      notes: 'Website was down',
    });
    const history = await api<{ items: { status: string; verifiedBy: { name: string } }[] }>(
      'GET',
      `/api/admin/verification?entityType=university&entityId=${uni.id}`,
    );
    expect(history.body.items).toEqual([
      expect.objectContaining({
        status: 'rejected',
        notes: 'Website was down',
        verifiedBy: { id: adminId, name: 'Kofi Content' },
      }),
    ]);
  });

  it('stamps an admission cycle as verified', async () => {
    const { body: uni } = await newUniversity('Cycle University');
    const programme = await api<{ id: string }>('POST', '/api/admin/programmes', {
      universityId: uni.id,
      name: 'BSc Physics',
      degreeType: 'bachelor',
    });
    const [cycle] = await db
      .insert(programmeAdmissionCycles)
      .values({ programmeId: programme.body.id, academicYear: '2026/2027' })
      .returning();
    const source = await api<{ id: string }>('POST', '/api/admin/sources', {
      title: 'Physics brochure',
    });
    await api('POST', '/api/admin/verification', {
      entityType: 'programme_admission_cycle',
      entityId: cycle!.id,
      sourceId: source.body.id,
      status: 'verified',
      verifiedAt: '2026-09-01T09:00:00Z',
    });
    const [after] = await db
      .select({ verifiedAt: programmeAdmissionCycles.verifiedAt })
      .from(programmeAdmissionCycles)
      .where(eq(programmeAdmissionCycles.id, cycle!.id));
    expect(after?.verifiedAt?.toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });
});

describe('stale records', () => {
  it('flags published records verified longer ago than the configured threshold', async () => {
    const { body: uni } = await newUniversity('Stale University');
    await publishUniversity(uni.id);
    const source = await api<{ id: string }>('POST', '/api/admin/sources', { title: 'Old source' });
    // Re-verified 400 days ago, after which nothing newer exists.
    await db.execute(sql`DELETE FROM verification_records WHERE entity_id = ${uni.id}`);
    await api('POST', '/api/admin/verification', {
      entityType: 'university',
      entityId: uni.id,
      sourceId: source.body.id,
      status: 'verified',
      verifiedAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
    });

    const stale = await api<{
      staleAfterDays: number;
      items: { entityId: string; label: string }[];
    }>('GET', '/api/admin/verification/stale');
    expect(stale.body.staleAfterDays).toBe(365);
    expect(stale.body.items.map((i) => i.entityId)).toContain(uni.id);

    const settings = await api('PATCH', '/api/admin/settings', { staleAfterDays: 500 });
    expect(settings.body).toEqual({ staleAfterDays: 500 });
    const relaxed = await api<{ items: { entityId: string }[] }>(
      'GET',
      '/api/admin/verification/stale',
    );
    expect(relaxed.body.items.map((i) => i.entityId)).not.toContain(uni.id);

    expect(await auditActions('stale_after_days')).toEqual(['settings.update']);
    await api('PATCH', '/api/admin/settings', { staleAfterDays: 365 });
  });

  it('rejects an invalid threshold', async () => {
    expect((await api('PATCH', '/api/admin/settings', { staleAfterDays: 0 })).status).toBe(400);
  });
});
