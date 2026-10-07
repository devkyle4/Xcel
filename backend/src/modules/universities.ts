import {
  type Paginated,
  type UniversityDetail,
  universityQuerySchema,
  type UniversitySummary,
} from '@xcel/shared';
import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { programmes, scholarships, universities } from '../db/schema';
import { cachePublicly, countOf, NotFoundError, paginate, parseQuery } from '../lib/http';
import { textSearch } from '../lib/search';
import { latestVerifications } from '../lib/verification';
import { programmeIsPublic, programmeSummaries } from './programmes';
import { scholarshipSummaries } from './scholarships';

const summaryColumns = {
  slug: universities.slug,
  name: universities.name,
  shortName: universities.shortName,
  region: universities.region,
  town: universities.town,
  institutionType: universities.institutionType,
  logoUrl: universities.logoUrl,
};

export function universityRoutes(db: () => Db) {
  return new Hono()
    .get('/', async (c) => {
      const query = parseQuery(c, universityQuerySchema);
      const conditions: SQL[] = [eq(universities.status, 'published')];
      let rank: SQL<number> | undefined;
      if (query.q) {
        const search = textSearch(
          {
            vector: universities.searchVector,
            name: universities.name,
            also: [universities.shortName],
          },
          query.q,
        );
        conditions.push(search.where);
        rank = search.rank;
      }
      if (query.region) conditions.push(eq(universities.region, query.region));
      if (query.type) conditions.push(eq(universities.institutionType, query.type));
      const where = and(...conditions)!;

      const [items, total] = await Promise.all([
        db()
          .select(summaryColumns)
          .from(universities)
          .where(where)
          .orderBy(...(rank ? [desc(rank)] : []), asc(universities.name))
          .limit(paginate(query).limit)
          .offset(paginate(query).offset),
        countOf(db().select({ total: count() }).from(universities).where(where)),
      ]);

      cachePublicly(c, 60);
      return c.json<Paginated<UniversitySummary>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/:slug', async (c) => {
      const slug = c.req.param('slug');
      const [university] = await db()
        .select({
          ...summaryColumns,
          id: universities.id,
          description: universities.description,
          websiteUrl: universities.websiteUrl,
          admissionsUrl: universities.admissionsUrl,
        })
        .from(universities)
        .where(and(eq(universities.slug, slug), eq(universities.status, 'published')));
      if (!university) throw new NotFoundError('University not found');

      const { id, ...rest } = university;
      const [programmeList, scholarshipList, verifications] = await Promise.all([
        programmeSummaries(db(), and(programmeIsPublic, eq(programmes.universityId, id))!, {
          orderBy: [asc(programmes.name)],
        }),
        scholarshipSummaries(db(), () => eq(scholarships.universityId, id)),
        latestVerifications(db(), 'university', [id]),
      ]);

      cachePublicly(c, 60);
      return c.json<UniversityDetail>({
        ...rest,
        verification: verifications.get(id) ?? null,
        programmes: programmeList,
        scholarships: scholarshipList,
      });
    });
}
