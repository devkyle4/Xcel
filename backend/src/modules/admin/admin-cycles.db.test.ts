import type { AdminCycle, EligibilityBundle, ProgrammeDetail } from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { getDatabase } from '../../db/client';
import {
  auditLogs,
  programmeAdmissionCycles,
  requirementGroups,
  requirementRules,
} from '../../db/schema';
import { seed } from '../../db/seed/seed';
import { type ApiCall, signInTestAdmin } from '../../test/admin-session';

const database = getDatabase();
const { db } = database;
const app = createApp();
let api: ApiCall;
let programmeId: string;
let sourceId: string;

const subject = (code: string, minGrade = 'C6') => ({
  kind: 'rule',
  ruleType: 'subject_grade',
  params: { subjectCodes: [code], minGrade },
});
const group = (operator: string, children: unknown[], minCount?: number) => ({
  kind: 'group',
  operator,
  ...(minCount !== undefined && { minCount }),
  children,
});

/** English and Core Maths, plus any 2 of Physics, Chemistry, Biology. */
const engineeringTree = group('all', [
  subject('ENGLISH'),
  subject('CORE_MATHS'),
  group('at_least', [subject('PHYSICS'), subject('CHEMISTRY'), subject('BIOLOGY')], 2),
]);

const newCycle = (academicYear = '2026/2027', extra = {}) =>
  api<AdminCycle>('POST', `/api/admin/programmes/${programmeId}/cycles`, {
    academicYear,
    ...extra,
  });

const setStatus = (cycleId: string, status: string) =>
  api<AdminCycle & { error: string; issues: { message: string }[] }>(
    'POST',
    `/api/admin/cycles/${cycleId}/status`,
    { status },
  );

const verify = (cycleId: string) =>
  api('POST', '/api/admin/verification', {
    entityType: 'programme_admission_cycle',
    entityId: cycleId,
    sourceId,
    status: 'verified',
  });

/** Takes a draft cycle through verification to published. */
async function publish(cycleId: string) {
  expect((await setStatus(cycleId, 'needs_verification')).status).toBe(200);
  await verify(cycleId);
  expect((await setStatus(cycleId, 'verified')).status).toBe(200);
  const published = await setStatus(cycleId, 'published');
  expect(published.status).toBe(200);
  return published.body;
}

beforeAll(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
  await seed(database);
  ({ api } = await signInTestAdmin(app, db, 'cycles-admin@example.com'));

  const uni = await api<{ id: string }>('POST', '/api/admin/universities', {
    name: 'Cycle Test University',
    institutionType: 'public_university',
  });
  const source = await api<{ id: string }>('POST', '/api/admin/sources', {
    title: 'Brochure 2026/2027',
  });
  sourceId = source.body.id;
  await api('POST', '/api/admin/verification', {
    entityType: 'university',
    entityId: uni.body.id,
    sourceId,
    status: 'verified',
  });
  for (const status of ['needs_verification', 'verified', 'published']) {
    await api('POST', `/api/admin/universities/${uni.body.id}/status`, { status });
  }
  const programme = await api<{ id: string }>('POST', '/api/admin/programmes', {
    universityId: uni.body.id,
    name: 'BSc Electrical Engineering',
    degreeType: 'bachelor',
  });
  programmeId = programme.body.id;
  for (const status of ['needs_verification', 'verified', 'published']) {
    await api('POST', `/api/admin/programmes/${programmeId}/status`, { status });
  }
});

afterAll(async () => {
  await database.sql.end();
});

describe('drafts', () => {
  it('creates an editable draft cycle, one per programme and year', async () => {
    const created = await newCycle('2030/2031', { applicationDeadline: '2030-08-31' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      version: 1,
      status: 'draft',
      editable: true,
      requirements: null,
      issues: [expect.objectContaining({ code: 'no_requirements' })],
      programme: { name: 'BSc Electrical Engineering', universityName: 'Cycle Test University' },
    });
    expect((await newCycle('2030/2031')).status).toBe(409);
    expect((await newCycle('2030-2031')).status).toBe(400);
  });

  it('saves and replaces a whole requirement tree, in order, with an audit trail', async () => {
    const { body: cycle } = await newCycle('2031/2032');
    const saved = await api<AdminCycle>('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: engineeringTree,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.issues).toEqual([]);
    expect(saved.body.requirements).toMatchObject({
      operator: 'all',
      children: [
        { params: { subjectCodes: ['ENGLISH'] } },
        { params: { subjectCodes: ['CORE_MATHS'] } },
        { operator: 'at_least', minCount: 2, children: [{}, {}, {}] },
      ],
    });

    // Sending the loaded tree back (with its ids) replaces it with new nodes.
    const again = await api<AdminCycle>('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: {
        ...saved.body.requirements,
        children: saved.body.requirements!.children.slice(0, 1),
      },
    });
    expect(again.body.requirements!.children).toHaveLength(1);
    expect(again.body.requirements!.id).not.toBe(saved.body.requirements!.id);
    expect(await db.$count(requirementGroups, eq(requirementGroups.cycleId, cycle.id))).toBe(1);

    const [entry] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'admission_cycle.requirements'))
      .orderBy(sql`${auditLogs.id} DESC`)
      .limit(1);
    expect(entry).toMatchObject({
      entityId: cycle.id,
      before: { operator: 'all' },
      after: { operator: 'all' },
    });
  });

  it('saves work in progress but reports problems', async () => {
    const { body: cycle } = await newCycle('2032/2033');
    const saved = await api<AdminCycle>('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: group('all', [subject('ASTRONOMY'), group('any', [])]),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.issues.map((i) => i.code).sort()).toEqual(['empty_group', 'unknown_codes']);

    expect(
      (
        await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
          requirements: group('at_least', [subject('PHYSICS')]),
        })
      ).status,
    ).toBe(400);
  });

  it('edits and deletes drafts', async () => {
    const { body: cycle } = await newCycle('2033/2034');
    await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: engineeringTree,
    });
    const edited = await api<AdminCycle>('PATCH', `/api/admin/cycles/${cycle.id}`, {
      applicationUrl: 'https://apply.example.edu',
    });
    expect(edited.body.applicationUrl).toBe('https://apply.example.edu');

    expect((await api('DELETE', `/api/admin/cycles/${cycle.id}`)).status).toBe(204);
    expect((await api('GET', `/api/admin/cycles/${cycle.id}`)).status).toBe(404);
    expect(await db.$count(requirementGroups, eq(requirementGroups.cycleId, cycle.id))).toBe(0);
  });
});

describe('publishing gates', () => {
  it('blocks Verified until the tree is valid and verified with a source', async () => {
    const { body: cycle } = await newCycle('2034/2035');
    await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: group('all', [subject('ASTRONOMY')]),
    });
    await setStatus(cycle.id, 'needs_verification');

    const invalid = await setStatus(cycle.id, 'verified');
    expect(invalid.status).toBe(409);
    expect(invalid.body.issues[0]?.message).toMatch(/ASTRONOMY/);

    await setStatus(cycle.id, 'draft');
    await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: engineeringTree,
    });
    await setStatus(cycle.id, 'needs_verification');
    expect((await setStatus(cycle.id, 'verified')).body.error).toMatch(/verification record/);

    await verify(cycle.id);
    expect((await setStatus(cycle.id, 'verified')).status).toBe(200);
  });

  it('rejects requirements that depend on aggregate alone', async () => {
    const { body: cycle } = await newCycle('2035/2036');
    await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: group('all', [
        {
          kind: 'rule',
          ruleType: 'aggregate_max',
          params: { maxAggregate: 24, components: [{ category: 'elective', count: 3 }] },
        },
      ]),
    });
    await setStatus(cycle.id, 'needs_verification');
    await verify(cycle.id);
    expect((await setStatus(cycle.id, 'verified')).body.issues[0]?.message).toMatch(
      /aggregate alone/,
    );
  });
});

describe('versioning', () => {
  it('freezes a published cycle and changes it only through a new version', async () => {
    const { body: draft } = await newCycle('2026/2027', { applicationDeadline: '2026-08-31' });
    await api('PUT', `/api/admin/cycles/${draft.id}/requirements`, {
      requirements: engineeringTree,
    });
    const v1 = await publish(draft.id);
    expect(v1).toMatchObject({ status: 'published', editable: false });

    // The public site now serves version 1.
    const publicV1 = await app.request(`/api/programmes/${programmeId}`);
    expect(((await publicV1.json()) as ProgrammeDetail).cycle?.requirements?.children).toHaveLength(
      3,
    );

    // Every way of changing version 1 is refused.
    expect(
      (await api('PUT', `/api/admin/cycles/${v1.id}/requirements`, { requirements: null })).status,
    ).toBe(409);
    expect((await api('PATCH', `/api/admin/cycles/${v1.id}`, { notes: 'edit' })).status).toBe(409);
    expect((await api('DELETE', `/api/admin/cycles/${v1.id}`)).status).toBe(409);
    await setStatus(v1.id, 'unpublished');
    expect((await setStatus(v1.id, 'needs_verification')).status).toBe(409);
    expect((await setStatus(v1.id, 'published')).status).toBe(200);

    // A new version copies the tree and dates and links back to version 1.
    const v2 = await api<AdminCycle>('POST', `/api/admin/cycles/${v1.id}/new-version`);
    expect(v2.status).toBe(201);
    expect(v2.body).toMatchObject({
      version: 2,
      status: 'draft',
      editable: true,
      supersedesCycleId: v1.id,
      applicationDeadline: '2026-08-31',
      requirements: { children: [{}, {}, { minCount: 2 }] },
    });
    expect(v2.body.versions.map((v) => [v.version, v.status])).toEqual([
      [2, 'draft'],
      [1, 'published'],
    ]);
    expect((await api('POST', `/api/admin/cycles/${v1.id}/new-version`)).status).toBe(409);

    // Change version 2: Physics is now required outright.
    await api('PUT', `/api/admin/cycles/${v2.body.id}/requirements`, {
      requirements: group('all', [
        subject('ENGLISH'),
        subject('CORE_MATHS'),
        subject('PHYSICS', 'B3'),
      ]),
    });
    await api('PATCH', `/api/admin/cycles/${v2.body.id}`, { applicationDeadline: '2026-09-15' });

    // Publishing version 2 archives version 1 in the same step.
    await publish(v2.body.id);
    const v1After = await api<AdminCycle>('GET', `/api/admin/cycles/${v1.id}`);
    expect(v1After.body).toMatchObject({
      status: 'archived',
      requirements: { children: [{}, {}, {}] },
    });

    const publicV2 = (await (
      await app.request(`/api/programmes/${programmeId}`)
    ).json()) as ProgrammeDetail;
    expect(publicV2.cycle).toMatchObject({ id: v2.body.id, applicationDeadline: '2026-09-15' });
    const bundle = (await (
      await app.request('/api/eligibility/requirements')
    ).json()) as EligibilityBundle;
    expect(bundle.programmes.find((p) => p.id === programmeId)?.cycleId).toBe(v2.body.id);

    const actions = await db
      .select({ action: auditLogs.action, entityId: auditLogs.entityId, after: auditLogs.after })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, v1.id));
    expect(actions.at(-1)).toMatchObject({
      action: 'admission_cycle.status',
      after: { status: 'archived', supersededBy: v2.body.id },
    });
  });

  it('protects published cycles in the database itself', async () => {
    const [published] = await db
      .select()
      .from(programmeAdmissionCycles)
      .where(eq(programmeAdmissionCycles.status, 'archived'))
      .limit(1);
    const [rootGroup] = await db
      .select()
      .from(requirementGroups)
      .where(eq(requirementGroups.cycleId, published!.id));

    const attempts = [
      db
        .update(programmeAdmissionCycles)
        .set({ applicationDeadline: '2099-01-01' })
        .where(eq(programmeAdmissionCycles.id, published!.id)),
      db.delete(programmeAdmissionCycles).where(eq(programmeAdmissionCycles.id, published!.id)),
      db.delete(requirementGroups).where(eq(requirementGroups.id, rootGroup!.id)),
      db
        .update(requirementRules)
        .set({ params: { subjectCodes: ['ENGLISH'], minGrade: 'F9' } })
        .where(eq(requirementRules.groupId, rootGroup!.id)),
      db.insert(requirementRules).values({
        groupId: rootGroup!.id,
        ruleType: 'manual_review',
        params: { description: 'x' },
      }),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toMatchObject({ cause: { code: '23000' } });
    }
    // Status changes are still allowed.
    await db
      .update(programmeAdmissionCycles)
      .set({ status: 'archived' })
      .where(eq(programmeAdmissionCycles.id, published!.id));
  });
});

describe('preview', () => {
  it('evaluates sample results against a draft without storing them', async () => {
    const { body: cycle } = await newCycle('2036/2037');
    await api('PUT', `/api/admin/cycles/${cycle.id}/requirements`, {
      requirements: engineeringTree,
    });
    const auditCount = await db.$count(auditLogs);

    const eligible = await api<{ status: string }>(
      'POST',
      `/api/admin/cycles/${cycle.id}/preview`,
      {
        results: { ENGLISH: 'B3', CORE_MATHS: 'C4', PHYSICS: 'C6', BIOLOGY: 'B2' },
      },
    );
    expect(eligible.body.status).toBe('Eligible');

    const notEligible = await api<{ status: string; causes: { id: string }[] }>(
      'POST',
      `/api/admin/cycles/${cycle.id}/preview`,
      { results: { ENGLISH: 'B3', CORE_MATHS: 'D7', PHYSICS: 'C6', BIOLOGY: 'B2' } },
    );
    expect(notEligible.body).toMatchObject({ status: 'NotEligible', causes: [{}] });

    expect(
      (await api('POST', `/api/admin/cycles/${cycle.id}/preview`, { results: { ENGLISH: 'Z9' } }))
        .status,
    ).toBe(400);
    expect(await db.$count(auditLogs)).toBe(auditCount);
  });
});
