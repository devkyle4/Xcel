import {
  type Paginated,
  programmeCreateSchema,
  programmeListQuerySchema,
  programmeUpdateSchema,
  statusChangeSchema,
} from '@xcel/shared';
import { and, asc, count, desc, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import {
  facultySchools,
  programmeAdmissionCycles,
  programmes,
  universities,
} from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import {
  countOf,
  NotFoundError,
  paginate,
  parseJson,
  parseQuery,
  uuidParam,
  ValidationError,
} from '../../lib/http';
import { transition } from '../../lib/publishing';
import { textSearch } from '../../lib/search';
import { uniqueSlug } from '../../lib/slug';

const { searchVector: _, ...programmeColumns } = getTableColumns(programmes);
export type AdminProgramme = Omit<typeof programmes.$inferSelect, 'searchVector'>;

export async function findProgramme(db: Db, id: string): Promise<AdminProgramme> {
  const [row] = await db.select(programmeColumns).from(programmes).where(eq(programmes.id, id));
  if (!row) throw new NotFoundError('Programme not found');
  return row;
}

/** A faculty or school must belong to the programme's university. */
async function assertFacultyBelongs(db: Db, facultySchoolId: string, universityId: string) {
  const [faculty] = await db
    .select({ universityId: facultySchools.universityId })
    .from(facultySchools)
    .where(eq(facultySchools.id, facultySchoolId));
  if (faculty?.universityId !== universityId) {
    throw new ValidationError([
      {
        path: 'facultySchoolId',
        message: "Choose a faculty or school of the programme's university",
      },
    ]);
  }
}

const slugTaken = (db: Db, universityId: string) => async (slug: string) =>
  (await db.$count(
    programmes,
    and(eq(programmes.universityId, universityId), eq(programmes.slug, slug)),
  )) > 0;

export function programmeAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const query = parseQuery(c, programmeListQuerySchema);
      const conditions: SQL[] = [];
      let rank: SQL<number> | undefined;
      if (query.q) {
        const search = textSearch(
          { vector: programmes.searchVector, name: programmes.name },
          query.q,
        );
        conditions.push(search.where);
        rank = search.rank;
      }
      if (query.status) conditions.push(eq(programmes.status, query.status));
      if (query.universityId) conditions.push(eq(programmes.universityId, query.universityId));
      const where = conditions.length ? and(...conditions) : undefined;

      const [items, total] = await Promise.all([
        db()
          .select({ ...programmeColumns, universityName: universities.name })
          .from(programmes)
          .innerJoin(universities, eq(universities.id, programmes.universityId))
          .where(where)
          .orderBy(...(rank ? [desc(rank)] : []), asc(universities.name), asc(programmes.name))
          .limit(paginate(query).limit)
          .offset(paginate(query).offset),
        countOf(db().select({ total: count() }).from(programmes).where(where)),
      ]);
      return c.json<Paginated<AdminProgramme & { universityName: string }>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .post('/', async (c) => {
      const input = await parseJson(c, programmeCreateSchema);
      const [university] = await db()
        .select({ id: universities.id })
        .from(universities)
        .where(eq(universities.id, input.universityId));
      if (!university)
        throw new ValidationError([{ path: 'universityId', message: 'No such university' }]);
      if (input.facultySchoolId)
        await assertFacultyBelongs(db(), input.facultySchoolId, input.universityId);

      const slug =
        input.slug ?? (await uniqueSlug(input.name, slugTaken(db(), input.universityId)));
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .insert(programmes)
          .values({ ...input, slug, status: 'draft' })
          .returning(programmeColumns);
        await audit({
          action: 'programme.create',
          entityType: 'programme',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    })
    .get('/:id', async (c) => {
      const programme = await findProgramme(db(), uuidParam(c, 'id'));
      const [[university], cycles] = await Promise.all([
        db()
          .select({
            id: universities.id,
            name: universities.name,
            slug: universities.slug,
            status: universities.status,
          })
          .from(universities)
          .where(eq(universities.id, programme.universityId)),
        db()
          .select({
            id: programmeAdmissionCycles.id,
            academicYear: programmeAdmissionCycles.academicYear,
            version: programmeAdmissionCycles.version,
            status: programmeAdmissionCycles.status,
            verifiedAt: programmeAdmissionCycles.verifiedAt,
            publishedAt: programmeAdmissionCycles.publishedAt,
          })
          .from(programmeAdmissionCycles)
          .where(eq(programmeAdmissionCycles.programmeId, programme.id))
          .orderBy(
            desc(programmeAdmissionCycles.academicYear),
            desc(programmeAdmissionCycles.version),
          ),
      ]);
      return c.json({ ...programme, university, admissionCycles: cycles });
    })
    .patch('/:id', async (c) => {
      const before = await findProgramme(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, programmeUpdateSchema);
      if (input.facultySchoolId)
        await assertFacultyBelongs(db(), input.facultySchoolId, before.universityId);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(programmes)
          .set(input)
          .where(eq(programmes.id, before.id))
          .returning(programmeColumns);
        await audit({
          action: 'programme.update',
          entityType: 'programme',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    })
    .post('/:id/status', async (c) => {
      const before = await findProgramme(db(), uuidParam(c, 'id'));
      const { status } = await parseJson(c, statusChangeSchema);
      const changes = transition(before.status, status);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(programmes)
          .set(changes)
          .where(eq(programmes.id, before.id))
          .returning(programmeColumns);
        await audit({
          action: 'programme.status',
          entityType: 'programme',
          entityId: before.id,
          before: { status: before.status },
          after: { status: row!.status },
        });
        return row!;
      });
      return c.json(updated);
    });
}
