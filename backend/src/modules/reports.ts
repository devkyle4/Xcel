import { reportCreateSchema } from '@xcel/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { programmes, scholarships, universities, userReports } from '../db/schema';
import { NotFoundError, parseJson } from '../lib/http';
import { clientIp, hitRateLimit, type RateLimit, rateLimitKey } from '../lib/rate-limit';
import { programmeIsPublic } from './programmes';

export const REPORT_LIMIT_PER_IP: RateLimit = { limit: 5, windowSeconds: 60 * 60 };

/** Resolves the public record being reported to its id, or throws 404. */
async function resolveEntity(db: Db, input: ReturnType<typeof reportCreateSchema.parse>) {
  let rows: { id: string }[];
  if (input.entityType === 'programme') {
    rows = await db
      .select({ id: programmes.id })
      .from(programmes)
      .innerJoin(universities, eq(universities.id, programmes.universityId))
      .where(and(programmeIsPublic, eq(programmes.id, input.entityId)));
  } else if (input.entityType === 'university') {
    rows = await db
      .select({ id: universities.id })
      .from(universities)
      .where(and(eq(universities.slug, input.slug), eq(universities.status, 'published')));
  } else {
    rows = await db
      .select({ id: scholarships.id })
      .from(scholarships)
      .where(
        and(
          eq(scholarships.slug, input.slug),
          inArray(scholarships.status, ['published', 'expired']),
        ),
      );
  }
  if (!rows[0]) throw new NotFoundError('That page could not be found');
  return rows[0].id;
}

/**
 * Public "report incorrect information". Stores only the message and what it
 * is about: no name, contact details or IP address.
 */
export function reportRoutes(db: () => Db) {
  return new Hono().post('/', async (c) => {
    c.header('Cache-Control', 'no-store');
    const limit = await hitRateLimit(
      db(),
      rateLimitKey('report-ip', clientIp(c.req.raw.headers)),
      REPORT_LIMIT_PER_IP,
    );
    if (!limit.allowed) {
      c.header('Retry-After', String(limit.retryAfterSeconds));
      return c.json({ error: 'Too many reports. Try again later.' }, 429);
    }

    const input = await parseJson(c, reportCreateSchema);
    const entityId = await resolveEntity(db(), input);
    await db()
      .insert(userReports)
      .values({ entityType: input.entityType, entityId, message: input.message });
    return c.json({ received: true }, 201);
  });
}
