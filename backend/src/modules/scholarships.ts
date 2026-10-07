import {
  ghanaToday,
  type Paginated,
  type ScholarshipDetail,
  scholarshipAvailability,
  scholarshipQuerySchema,
  type ScholarshipSummary,
} from '@xcel/shared';
import { and, asc, count, desc, eq, ilike, inArray, type SQL, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import {
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  universities,
} from '../db/schema';
import { cachePublicly, countOf, NotFoundError, paginate, parseQuery } from '../lib/http';
import { arrayContainsIgnoreCase, escapeLike, textSearch } from '../lib/search';
import { latestVerifications } from '../lib/verification';

/** Draft and archived scholarships are never public; expired ones are shown as closed. */
const PUBLIC_STATUSES = ['published', 'expired'] as const;

/** Each scholarship's latest cycle. */
export function currentScholarshipCycles(db: Db) {
  return db
    .selectDistinctOn([scholarshipCycles.scholarshipId], {
      scholarshipId: scholarshipCycles.scholarshipId,
      cycleId: sql<string>`${scholarshipCycles.id}`.as('cycle_id'),
      academicYear: scholarshipCycles.academicYear,
      opensOn: scholarshipCycles.opensOn,
      closesOn: scholarshipCycles.closesOn,
      applicationUrl: scholarshipCycles.applicationUrl,
    })
    .from(scholarshipCycles)
    .orderBy(scholarshipCycles.scholarshipId, desc(scholarshipCycles.academicYear))
    .as('current_cycle');
}

type CurrentCycles = ReturnType<typeof currentScholarshipCycles>;

/** SQL twin of scholarshipAvailability() in the shared package, used for filtering. */
function availabilitySql(current: CurrentCycles, today: string): SQL<string> {
  return sql<string>`CASE
    WHEN ${scholarships.status} = 'expired' OR ${current.closesOn} < ${today} THEN 'closed'
    WHEN ${current.opensOn} > ${today} THEN 'upcoming'
    WHEN ${current.opensOn} IS NULL AND ${current.closesOn} IS NULL THEN 'unknown'
    ELSE 'open' END`;
}

export async function scholarshipSummaries(
  db: Db,
  where: (current: CurrentCycles, today: string) => SQL,
  options: {
    orderBy?: (current: CurrentCycles, today: string) => SQL[];
    limit?: number;
    offset?: number;
  } = {},
) {
  const today = ghanaToday();
  const current = currentScholarshipCycles(db);
  const query = db
    .select({
      slug: scholarships.slug,
      name: scholarships.name,
      providerName: scholarships.providerName,
      studyLevels: scholarships.studyLevels,
      fields: scholarships.fields,
      eligibilityCategories: scholarships.eligibilityCategories,
      location: scholarships.location,
      coverage: scholarships.coverage,
      status: scholarships.status,
      academicYear: current.academicYear,
      opensOn: current.opensOn,
      closesOn: current.closesOn,
    })
    .from(scholarships)
    .leftJoin(current, eq(current.scholarshipId, scholarships.id))
    .where(and(inArray(scholarships.status, PUBLIC_STATUSES), where(current, today)))
    .orderBy(
      ...(options.orderBy?.(current, today) ?? [
        sql`array_position(ARRAY['open','upcoming','unknown','closed'], ${availabilitySql(current, today)})`,
        sql`${current.closesOn} ASC NULLS LAST`,
        asc(scholarships.name),
      ]),
    )
    .$dynamic();
  if (options.limit !== undefined) query.limit(options.limit).offset(options.offset ?? 0);

  const rows = await query;
  return rows.map(({ status, ...row }): ScholarshipSummary => ({
    ...row,
    availability: scholarshipAvailability(
      { status, opensOn: row.opensOn, closesOn: row.closesOn },
      today,
    ),
  }));
}

export function scholarshipRoutes(db: () => Db) {
  return new Hono()
    .get('/', async (c) => {
      const query = parseQuery(c, scholarshipQuerySchema);
      let rank: SQL<number> | undefined;

      const where = (current: CurrentCycles, today: string) => {
        const conditions: SQL[] = [];
        if (query.q) {
          const search = textSearch(
            {
              vector: scholarships.searchVector,
              name: scholarships.name,
              also: [scholarships.providerName],
            },
            query.q,
          );
          conditions.push(search.where);
          rank = search.rank;
        }
        if (query.studyLevel) {
          conditions.push(sql`${query.studyLevel}::study_level = ANY(${scholarships.studyLevels})`);
        }
        if (query.field) conditions.push(arrayContainsIgnoreCase(scholarships.fields, query.field));
        if (query.category) {
          conditions.push(
            arrayContainsIgnoreCase(scholarships.eligibilityCategories, query.category),
          );
        }
        if (query.location) {
          conditions.push(ilike(scholarships.location, `%${escapeLike(query.location)}%`));
        }
        if (query.availability) {
          conditions.push(inArray(availabilitySql(current, today), query.availability) as SQL);
        }
        return and(sql`true`, ...conditions)!;
      };

      const items = await scholarshipSummaries(db(), where, {
        ...paginate(query),
        ...(query.q && {
          orderBy: () => [desc(rank!), asc(scholarships.name)],
        }),
      });

      const current = currentScholarshipCycles(db());
      const today = ghanaToday();
      const total = await countOf(
        db()
          .select({ total: count() })
          .from(scholarships)
          .leftJoin(current, eq(current.scholarshipId, scholarships.id))
          .where(and(inArray(scholarships.status, PUBLIC_STATUSES), where(current, today))),
      );

      cachePublicly(c, 60);
      return c.json<Paginated<ScholarshipSummary>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/:slug', async (c) => {
      const slug = c.req.param('slug');
      const [summary] = await scholarshipSummaries(db(), () => eq(scholarships.slug, slug));
      if (!summary) throw new NotFoundError('Scholarship not found');

      const [row] = await db()
        .select({
          id: scholarships.id,
          description: scholarships.description,
          providerUrl: scholarships.providerUrl,
          universitySlug: universities.slug,
          universityName: universities.name,
          universityStatus: universities.status,
        })
        .from(scholarships)
        .leftJoin(universities, eq(universities.id, scholarships.universityId))
        .where(eq(scholarships.slug, slug));

      const [cycle] = await db()
        .select({ id: scholarshipCycles.id, applicationUrl: scholarshipCycles.applicationUrl })
        .from(scholarshipCycles)
        .where(eq(scholarshipCycles.scholarshipId, row!.id))
        .orderBy(desc(scholarshipCycles.academicYear))
        .limit(1);

      const [requirements, verifications] = cycle
        ? await Promise.all([
            db()
              .select({ description: scholarshipRequirements.description })
              .from(scholarshipRequirements)
              .where(eq(scholarshipRequirements.cycleId, cycle.id))
              .orderBy(asc(scholarshipRequirements.sortOrder)),
            latestVerifications(db(), 'scholarship_cycle', [cycle.id]),
          ])
        : [[], new Map()];

      cachePublicly(c, 60);
      return c.json<ScholarshipDetail>({
        ...summary,
        description: row!.description,
        providerUrl: row!.providerUrl,
        applicationUrl: cycle?.applicationUrl ?? null,
        // Only link a university that is itself public.
        university:
          row!.universitySlug && row!.universityStatus === 'published'
            ? { slug: row!.universitySlug, name: row!.universityName! }
            : null,
        requirements: requirements.map((r) => r.description),
        verification: (cycle && verifications.get(cycle.id)) ?? null,
      });
    });
}
