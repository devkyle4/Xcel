import type { AdminMentor, MentorDetail, MentorSummary, Paginated } from '@xcel/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase } from '../db/client';
import { auditLogs, mentorRequestStats } from '../db/schema';
import { type Mailer, memoryMailer } from '../lib/mailer';
import { type ApiCall, signInTestAdmin } from '../test/admin-session';

const database = getDatabase();
const { db } = database;
let outbox = memoryMailer();
let mailer: Mailer = outbox;
let captchaPasses = true;
const app = createApp({
  getMailer: () => mailer,
  getCaptchaVerifier: () => async (token) => captchaPasses && token === 'valid-token',
});
let api: ApiCall;
let mentor: AdminMentor;

const CONTACT = 'ama.private@example.com';

const validRequest = {
  fullName: 'Kofi Boateng',
  phone: '024 412 3456',
  email: 'kofi@example.com',
  topic: 'scholarship_guidance',
  message: 'Hello Ama, I would like to talk about scholarships.',
  disclaimerAccepted: true,
  captchaToken: 'valid-token',
};

const sendRequest = (slug: string, body: unknown, ip = '198.51.100.20') =>
  app.request(`/api/mentors/${slug}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
  ({ api } = await signInTestAdmin(app, db, 'mentors-admin@example.com'));
  const created = await api<AdminMentor>('POST', '/api/admin/mentors', {
    fullName: 'Ama Mensah',
    headline: 'Medical student, University of Ghana',
    bio: 'I help students choose health programmes.',
    contactEmail: CONTACT,
  });
  mentor = created.body;
  await api('PUT', `/api/admin/mentors/${mentor.id}/expertise`, {
    topics: ['choosing_programme', 'scholarship_guidance'],
    fields: ['Health Sciences'],
    programmeAreas: ['Medicine'],
  });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE rate_limits`);
  outbox = memoryMailer();
  mailer = outbox;
  captchaPasses = true;
});

afterAll(async () => {
  await database.sql.end();
});

describe('admin mentor management', () => {
  it('creates mentors as inactive with an audited private email', async () => {
    expect(mentor).toMatchObject({ slug: 'ama-mensah', status: 'inactive', contactEmail: CONTACT });
    const actions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, mentor.id))
      .orderBy(auditLogs.id);
    expect(actions.map((a) => a.action)).toEqual(['mentor.create', 'mentor.expertise']);
  });

  it('keeps inactive mentors out of public view and unable to receive requests', async () => {
    expect((await app.request('/api/mentors/ama-mensah')).status).toBe(404);
    expect((await sendRequest('ama-mensah', validRequest)).status).toBe(404);
    expect(outbox.outbox).toHaveLength(0);
  });

  it('requires an admin session', async () => {
    expect((await app.request('/api/admin/mentors')).status).toBe(401);
  });
});

describe('public mentor directory', () => {
  beforeAll(async () => {
    await api('POST', `/api/admin/mentors/${mentor.id}/status`, { status: 'active' });
  });

  it('lists active mentors with their expertise, filterable by topic and field', async () => {
    const all = (await (await app.request('/api/mentors')).json()) as Paginated<MentorSummary>;
    expect(all.items).toEqual([
      expect.objectContaining({
        slug: 'ama-mensah',
        topics: ['choosing_programme', 'scholarship_guidance'],
        fields: ['Health Sciences'],
      }),
    ]);
    const byTopic = (await (
      await app.request('/api/mentors?topic=scholarship_guidance')
    ).json()) as Paginated<MentorSummary>;
    expect(byTopic.total).toBe(1);
    const otherTopic = (await (
      await app.request('/api/mentors?topic=comparing_programmes')
    ).json()) as Paginated<MentorSummary>;
    expect(otherTopic.total).toBe(0);
    const byField = (await (
      await app.request('/api/mentors?field=health%20sciences')
    ).json()) as Paginated<MentorSummary>;
    expect(byField.total).toBe(1);
  });

  it('never sends the contact email to the browser', async () => {
    const list = await (await app.request('/api/mentors')).text();
    const detail = await (await app.request('/api/mentors/ama-mensah')).text();
    expect(list).not.toContain(CONTACT);
    expect(detail).not.toContain(CONTACT);
    expect(JSON.parse(detail) as MentorDetail).toMatchObject({
      programmeAreas: ['Medicine'],
      bio: expect.any(String),
    });
  });
});

describe('session requests', () => {
  beforeAll(async () => {
    await api('POST', `/api/admin/mentors/${mentor.id}/status`, { status: 'active' });
  });

  it('emails the mentor in the agreed format and confirms the phone number', async () => {
    const res = await sendRequest('ama-mensah', validRequest);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sent: true,
      mentorName: 'Ama Mensah',
      phone: '+233244123456',
    });
    expect(res.headers.get('cache-control')).toBe('no-store');

    expect(outbox.outbox).toEqual([
      {
        to: CONTACT,
        subject: 'Mentoring request from Kofi Boateng – Scholarship guidance',
        text: expect.stringContaining('Phone:  +233 24 412 3456'),
        replyTo: 'kofi@example.com',
      },
    ]);
    expect(outbox.outbox[0]!.text).toContain('Sent via Xcel');
  });

  it('stores only a monthly count, never the request', async () => {
    await sendRequest('ama-mensah', validRequest);
    const [stats] = await db
      .select()
      .from(mentorRequestStats)
      .where(eq(mentorRequestStats.mentorId, mentor.id));
    expect(stats!.sentCount).toBeGreaterThanOrEqual(1);

    // Nothing anywhere in the database contains the student's details.
    const dump = await db.execute<{ hit: string }>(sql`
      SELECT table_name AS hit FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND query_to_xml(format('SELECT * FROM %I', t.table_name), true, false, '')::text ~* '(Kofi Boateng|244123456|kofi@example.com)'`);
    expect(dump.map((r) => r.hit)).toEqual([]);
  });

  it.each([
    ['an invalid phone', { phone: '030 212 3456' }, 400],
    ['no disclaimer', { disclaimerAccepted: false }, 400],
    ['a failed security check', { captchaToken: 'forged' }, 400],
  ])('refuses a request with %s', async (_, change, status) => {
    const res = await sendRequest('ama-mensah', { ...validRequest, ...change });
    expect(res.status).toBe(status);
    expect(outbox.outbox).toHaveLength(0);
  });

  it('reports a sending failure so the form can be kept, counting the failure', async () => {
    mailer = {
      send: async () => {
        throw new Error('provider down');
      },
    };
    const res = await sendRequest('ama-mensah', validRequest);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'Your message could not be sent. Please try again.',
    });
    const [stats] = await db
      .select()
      .from(mentorRequestStats)
      .where(eq(mentorRequestStats.mentorId, mentor.id));
    expect(stats!.failedCount).toBeGreaterThanOrEqual(1);
  });

  it('allows about five requests an hour per IP', async () => {
    for (let i = 0; i < 5; i++)
      expect((await sendRequest('ama-mensah', validRequest, '198.51.100.77')).status).toBe(200);
    expect((await sendRequest('ama-mensah', validRequest, '198.51.100.77')).status).toBe(429);
  });

  it('stops requests to deactivated or archived mentors', async () => {
    await api('POST', `/api/admin/mentors/${mentor.id}/status`, { status: 'archived' });
    expect((await sendRequest('ama-mensah', validRequest)).status).toBe(404);
    const admin = await api<AdminMentor[]>('GET', '/api/admin/mentors');
    expect(admin.body.find((m) => m.id === mentor.id)).toMatchObject({ status: 'archived' });
    expect(admin.body.find((m) => m.id === mentor.id)!.requestsSent).toBeGreaterThanOrEqual(1);
  });
});
