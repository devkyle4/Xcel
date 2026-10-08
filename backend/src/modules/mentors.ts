import {
  type MentorDetail,
  mentorQuerySchema,
  type MentorSummary,
  type MentoringTopicCode,
  type Paginated,
  buildMentorEmail,
  sessionRequestSchema,
  type SessionRequestResponse,
} from '@xcel/shared';
import { and, asc, count, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { mentorExpertise, mentorRequestStats, mentors } from '../db/schema';
import type { CaptchaVerifier } from '../lib/captcha';
import {
  cachePublicly,
  countOf,
  NotFoundError,
  paginate,
  parseJson,
  parseQuery,
} from '../lib/http';
import type { Mailer } from '../lib/mailer';
import { clientIp, hitRateLimit, type RateLimit, rateLimitKey } from '../lib/rate-limit';
import { escapeLike } from '../lib/search';

export const MENTOR_REQUEST_LIMIT_PER_IP: RateLimit = { limit: 5, windowSeconds: 60 * 60 };

/** Public columns only: the contact email is never selected for public responses. */
const publicColumns = {
  id: mentors.id,
  slug: mentors.slug,
  fullName: mentors.fullName,
  headline: mentors.headline,
  photoUrl: mentors.photoUrl,
  bio: mentors.bio,
  background: mentors.background,
};

async function expertiseFor(db: Db, mentorIds: string[]) {
  const rows = mentorIds.length
    ? await db
        .select()
        .from(mentorExpertise)
        .where(inArray(mentorExpertise.mentorId, mentorIds))
        .orderBy(asc(mentorExpertise.value))
    : [];
  const by = (id: string, kind: (typeof rows)[number]['kind']) =>
    rows.filter((r) => r.mentorId === id && r.kind === kind).map((r) => r.value);
  return {
    topics: (id: string) => by(id, 'topic') as MentoringTopicCode[],
    fields: (id: string) => by(id, 'field'),
    programmeAreas: (id: string) => by(id, 'programme_area'),
  };
}

/** Counts only, per calendar month; no request content is ever stored. */
async function recordRequest(db: Db, mentorId: string, sent: boolean) {
  const month = new Date().toISOString().slice(0, 7) + '-01';
  await db
    .insert(mentorRequestStats)
    .values({ mentorId, month, sentCount: sent ? 1 : 0, failedCount: sent ? 0 : 1 })
    .onConflictDoUpdate({
      target: [mentorRequestStats.mentorId, mentorRequestStats.month],
      set: sent
        ? { sentCount: sql`${mentorRequestStats.sentCount} + 1` }
        : { failedCount: sql`${mentorRequestStats.failedCount} + 1` },
    });
}

export function mentorRoutes(
  db: () => Db,
  deps: { mailer: () => Mailer; verifyCaptcha: () => CaptchaVerifier },
) {
  return new Hono()
    .get('/', async (c) => {
      const query = parseQuery(c, mentorQuerySchema);
      const conditions: SQL[] = [eq(mentors.status, 'active')];
      if (query.q) {
        const pattern = `%${escapeLike(query.q)}%`;
        conditions.push(
          or(
            ilike(mentors.fullName, pattern),
            ilike(mentors.headline, pattern),
            ilike(mentors.bio, pattern),
          )!,
        );
      }
      const hasExpertise = (kind: 'topic' | 'field', value: SQL) =>
        sql`EXISTS (SELECT 1 FROM ${mentorExpertise} WHERE ${mentorExpertise.mentorId} = ${mentors.id} AND ${mentorExpertise.kind} = ${kind} AND ${value})`;
      if (query.topic)
        conditions.push(hasExpertise('topic', sql`${mentorExpertise.value} = ${query.topic}`));
      if (query.field)
        conditions.push(
          hasExpertise('field', sql`lower(${mentorExpertise.value}) = lower(${query.field})`),
        );
      const where = and(...conditions);

      const [rows, total] = await Promise.all([
        db()
          .select(publicColumns)
          .from(mentors)
          .where(where)
          .orderBy(asc(mentors.fullName))
          .limit(paginate(query).limit)
          .offset(paginate(query).offset),
        countOf(db().select({ total: count() }).from(mentors).where(where)),
      ]);
      const expertise = await expertiseFor(
        db(),
        rows.map((r) => r.id),
      );
      cachePublicly(c, 60);
      return c.json<Paginated<MentorSummary>>({
        items: rows.map((m) => ({
          slug: m.slug,
          fullName: m.fullName,
          headline: m.headline,
          photoUrl: m.photoUrl,
          topics: expertise.topics(m.id),
          fields: expertise.fields(m.id),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/:slug', async (c) => {
      const [m] = await db()
        .select(publicColumns)
        .from(mentors)
        .where(and(eq(mentors.slug, c.req.param('slug')), eq(mentors.status, 'active')));
      if (!m) throw new NotFoundError('Mentor not found');
      const expertise = await expertiseFor(db(), [m.id]);
      cachePublicly(c, 60);
      return c.json<MentorDetail>({
        slug: m.slug,
        fullName: m.fullName,
        headline: m.headline,
        photoUrl: m.photoUrl,
        bio: m.bio,
        background: m.background,
        topics: expertise.topics(m.id),
        fields: expertise.fields(m.id),
        programmeAreas: expertise.programmeAreas(m.id),
      });
    })
    .post('/:slug/request', async (c) => {
      // The request is emailed and then discarded: never stored, cached or logged.
      c.header('Cache-Control', 'no-store');
      const ip = clientIp(c.req.raw.headers);
      const limit = await hitRateLimit(
        db(),
        rateLimitKey('mentor-request-ip', ip),
        MENTOR_REQUEST_LIMIT_PER_IP,
      );
      if (!limit.allowed) {
        c.header('Retry-After', String(limit.retryAfterSeconds));
        return c.json(
          { error: 'You have sent several requests recently. Please try again later.' },
          429,
        );
      }

      const request = await parseJson(c, sessionRequestSchema);
      if (!(await deps.verifyCaptcha()(request.captchaToken, ip))) {
        return c.json({ error: 'The security check failed. Please try it again.' }, 400);
      }

      const [mentor] = await db()
        .select({ id: mentors.id, fullName: mentors.fullName, contactEmail: mentors.contactEmail })
        .from(mentors)
        .where(and(eq(mentors.slug, c.req.param('slug')), eq(mentors.status, 'active')));
      if (!mentor) throw new NotFoundError('This mentor is not currently taking requests');

      try {
        await deps.mailer().send({ to: mentor.contactEmail, ...buildMentorEmail(request) });
      } catch {
        // Only the fact of the failure is recorded; never the request or the error details.
        await recordRequest(db(), mentor.id, false);
        return c.json({ error: 'Your message could not be sent. Please try again.' }, 502);
      }
      await recordRequest(db(), mentor.id, true);
      return c.json<SessionRequestResponse>({
        sent: true,
        mentorName: mentor.fullName,
        phone: request.phone,
      });
    });
}
