import {
  adminListQuerySchema,
  facultySchoolInputSchema,
  type Paginated,
  statusChangeSchema,
  universityCreateSchema,
  universityUpdateSchema,
} from '@xcel/shared';
import { and, asc, count, desc, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { facultySchools, programmes, universities, verificationRecords } from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import {
  ConflictError,
  countOf,
  NotFoundError,
  paginate,
  parseJson,
  parseQuery,
  uuidParam,
} from '../../lib/http';
import { transition } from '../../lib/publishing';
import { textSearch } from '../../lib/search';
import { uniqueSlug } from '../../lib/slug';
import { isCurrentlyVerified, listVerifications } from './verification';

const { searchVector: _, ...universityColumns } = getTableColumns(universities);
export type AdminUniversity = Omit<typeof universities.$inferSelect, 'searchVector'>;

export async function findUniversity(db: Db, id: string): Promise<AdminUniversity> {
  const [row] = await db
    .select(universityColumns)
    .from(universities)
    .where(eq(universities.id, id));
  if (!row) throw new NotFoundError('University not found');
  return row;
}

async function findFacultySchool(db: Db, id: string) {
  const [row] = await db.select().from(facultySchools).where(eq(facultySchools.id, id));
  if (!row) throw new NotFoundError('Faculty or school not found');
  return row;
}

export function universityAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const query = parseQuery(c, adminListQuerySchema);
      const conditions: SQL[] = [];
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
      if (query.status) conditions.push(eq(universities.status, query.status));
      const where = conditions.length ? and(...conditions) : undefined;

      const [items, total] = await Promise.all([
        db()
          .select(universityColumns)
          .from(universities)
          .where(where)
          .orderBy(...(rank ? [desc(rank)] : []), asc(universities.name))
          .limit(paginate(query).limit)
          .offset(paginate(query).offset),
        countOf(db().select({ total: count() }).from(universities).where(where)),
      ]);
      return c.json<Paginated<AdminUniversity>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .post('/', async (c) => {
      const input = await parseJson(c, universityCreateSchema);
      const slug =
        input.slug ??
        (await uniqueSlug(
          input.name,
          async (s) => (await db().$count(universities, eq(universities.slug, s))) > 0,
        ));
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .insert(universities)
          .values({ ...input, slug, status: 'draft' })
          .returning(universityColumns);
        await audit({
          action: 'university.create',
          entityType: 'university',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    })
    .get('/:id', async (c) => {
      const university = await findUniversity(db(), uuidParam(c, 'id'));
      const [faculties, verifications] = await Promise.all([
        db()
          .select()
          .from(facultySchools)
          .where(eq(facultySchools.universityId, university.id))
          .orderBy(asc(facultySchools.name)),
        listVerifications(
          db(),
          and(
            eq(verificationRecords.entityType, 'university'),
            eq(verificationRecords.entityId, university.id),
          ),
          { limit: 20, offset: 0 },
        ),
      ]);
      return c.json({ ...university, facultySchools: faculties, verifications });
    })
    .patch('/:id', async (c) => {
      const before = await findUniversity(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, universityUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(universities)
          .set(input)
          .where(eq(universities.id, before.id))
          .returning(universityColumns);
        await audit({
          action: 'university.update',
          entityType: 'university',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    })
    .post('/:id/status', async (c) => {
      const before = await findUniversity(db(), uuidParam(c, 'id'));
      const { status } = await parseJson(c, statusChangeSchema);
      const changes = transition(before.status, status);
      if (status === 'verified' && !(await isCurrentlyVerified(db(), 'university', before.id))) {
        throw new ConflictError(
          'Add a verification record with a source before marking this verified',
        );
      }
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(universities)
          .set(changes)
          .where(eq(universities.id, before.id))
          .returning(universityColumns);
        await audit({
          action: 'university.status',
          entityType: 'university',
          entityId: before.id,
          before: { status: before.status },
          after: { status: row!.status },
        });
        return row!;
      });
      return c.json(updated);
    })
    .post('/:id/faculty-schools', async (c) => {
      const university = await findUniversity(db(), uuidParam(c, 'id'));
      const { name } = await parseJson(c, facultySchoolInputSchema);
      const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .insert(facultySchools)
          .values({ universityId: university.id, name })
          .returning();
        await audit({
          action: 'faculty_school.create',
          entityType: 'faculty_school',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    });
}

export function facultySchoolAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .patch('/:id', async (c) => {
      const before = await findFacultySchool(db(), uuidParam(c, 'id'));
      const { name } = await parseJson(c, facultySchoolInputSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(facultySchools)
          .set({ name })
          .where(eq(facultySchools.id, before.id))
          .returning();
        await audit({
          action: 'faculty_school.update',
          entityType: 'faculty_school',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    })
    .delete('/:id', async (c) => {
      const before = await findFacultySchool(db(), uuidParam(c, 'id'));
      const inUse = await db().$count(programmes, eq(programmes.facultySchoolId, before.id));
      if (inUse > 0) {
        throw new ConflictError(
          `${inUse} programme(s) belong to this faculty or school; move them first`,
        );
      }
      await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        await tx.delete(facultySchools).where(eq(facultySchools.id, before.id));
        await audit({
          action: 'faculty_school.delete',
          entityType: 'faculty_school',
          entityId: before.id,
          before,
        });
      });
      return c.body(null, 204);
    });
}
