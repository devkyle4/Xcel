import {
  type AdmissionCycleInfo,
  type Paginated,
  type ProgrammeDetail,
  programmeDetailQuerySchema,
  programmeQuerySchema,
  type ProgrammeSummary,
} from '@xcel/shared';
import { and, asc, count, desc, eq, type SQL, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { facultySchools, programmeAdmissionCycles, programmes, universities } from '../db/schema';
import {
  cachePublicly,
  countOf,
  NotFoundError,
  paginate,
  parseQuery,
  uuidParam,
} from '../lib/http';
import { loadRequirementTrees } from '../lib/requirements';
import { textSearch } from '../lib/search';
import { latestVerifications } from '../lib/verification';

/** Each programme's latest published admission cycle. */
export function currentCycles(db: Db) {
  return db
    .selectDistinctOn([programmeAdmissionCycles.programmeId], {
      programmeId: programmeAdmissionCycles.programmeId,
      cycleId: sql<string>`${programmeAdmissionCycles.id}`.as('cycle_id'),
      academicYear: programmeAdmissionCycles.academicYear,
    })
    .from(programmeAdmissionCycles)
    .where(eq(programmeAdmissionCycles.status, 'published'))
    .orderBy(programmeAdmissionCycles.programmeId, desc(programmeAdmissionCycles.academicYear))
    .as('current_cycle');
}

/** Both the programme and its university must be published to appear publicly. */
export const programmeIsPublic = and(
  eq(programmes.status, 'published'),
  eq(universities.status, 'published'),
)!;

export const universityRefColumns = {
  slug: universities.slug,
  name: universities.name,
  shortName: universities.shortName,
  region: universities.region,
  town: universities.town,
};

/** Programme summaries matching `where`, with their latest published admission year. */
export async function programmeSummaries(
  db: Db,
  where: SQL,
  options: { orderBy?: SQL[]; limit?: number; offset?: number } = {},
): Promise<ProgrammeSummary[]> {
  const current = currentCycles(db);
  const query = db
    .select({
      id: programmes.id,
      name: programmes.name,
      field: programmes.field,
      degreeType: programmes.degreeType,
      durationYears: programmes.durationYears,
      campus: programmes.campus,
      university: universityRefColumns,
      academicYear: current.academicYear,
    })
    .from(programmes)
    .innerJoin(universities, eq(universities.id, programmes.universityId))
    .leftJoin(current, eq(current.programmeId, programmes.id))
    .where(where)
    .orderBy(...(options.orderBy ?? [asc(universities.name), asc(programmes.name)]))
    .$dynamic();
  if (options.limit !== undefined) query.limit(options.limit).offset(options.offset ?? 0);
  return query;
}

export function programmeRoutes(db: () => Db) {
  return new Hono()
    .get('/', async (c) => {
      const query = parseQuery(c, programmeQuerySchema);
      const conditions: SQL[] = [programmeIsPublic];
      let rank: SQL<number> | undefined;
      if (query.q) {
        const search = textSearch(
          { vector: programmes.searchVector, name: programmes.name },
          query.q,
        );
        conditions.push(search.where);
        rank = search.rank;
      }
      if (query.university) conditions.push(eq(universities.slug, query.university));
      if (query.field) conditions.push(sql`lower(${programmes.field}) = lower(${query.field})`);
      if (query.degreeType) conditions.push(eq(programmes.degreeType, query.degreeType));
      if (query.region) conditions.push(eq(universities.region, query.region));
      const where = and(...conditions)!;

      const [items, total] = await Promise.all([
        programmeSummaries(db(), where, {
          orderBy: [...(rank ? [desc(rank)] : []), asc(universities.name), asc(programmes.name)],
          ...paginate(query),
        }),
        countOf(
          db()
            .select({ total: count() })
            .from(programmes)
            .innerJoin(universities, eq(universities.id, programmes.universityId))
            .where(where),
        ),
      ]);

      cachePublicly(c, 60);
      return c.json<Paginated<ProgrammeSummary>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/:id', async (c) => {
      const id = uuidParam(c, 'id');
      const { year } = parseQuery(c, programmeDetailQuerySchema);

      const [summary] = await programmeSummaries(
        db(),
        and(programmeIsPublic, eq(programmes.id, id))!,
      );
      if (!summary) throw new NotFoundError('Programme not found');

      const [details] = await db()
        .select({ description: programmes.description, facultySchool: facultySchools.name })
        .from(programmes)
        .leftJoin(facultySchools, eq(facultySchools.id, programmes.facultySchoolId))
        .where(eq(programmes.id, id));

      const cycles = await db()
        .select()
        .from(programmeAdmissionCycles)
        .where(
          and(
            eq(programmeAdmissionCycles.programmeId, id),
            eq(programmeAdmissionCycles.status, 'published'),
          ),
        )
        .orderBy(desc(programmeAdmissionCycles.academicYear));

      const selected = year ? cycles.find((cy) => cy.academicYear === year) : cycles[0];
      if (year && !selected) {
        throw new NotFoundError(`No published requirements for ${year}`);
      }

      let cycle: AdmissionCycleInfo | null = null;
      if (selected) {
        const [trees, verifications] = await Promise.all([
          loadRequirementTrees(db(), [selected.id]),
          latestVerifications(db(), 'programme_admission_cycle', [selected.id]),
        ]);
        cycle = {
          id: selected.id,
          academicYear: selected.academicYear,
          version: selected.version,
          applicationOpensOn: selected.applicationOpensOn,
          applicationDeadline: selected.applicationDeadline,
          applicationUrl: selected.applicationUrl,
          notes: selected.notes,
          requirements: trees.get(selected.id) ?? null,
          verification: verifications.get(selected.id) ?? null,
        };
      }

      cachePublicly(c, 60);
      return c.json<ProgrammeDetail>({
        ...summary,
        description: details?.description ?? null,
        facultySchool: details?.facultySchool ?? null,
        availableYears: cycles.map((cy) => cy.academicYear),
        cycle,
      });
    });
}
