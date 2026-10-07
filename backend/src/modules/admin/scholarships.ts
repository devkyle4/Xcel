import {
  type AdminScholarshipCycle,
  type AdminScholarshipListItem,
  ghanaToday,
  type Paginated,
  SCHOLARSHIP_TRANSITIONS,
  scholarshipAvailability,
  scholarshipCreateSchema,
  scholarshipCycleCreateSchema,
  scholarshipCycleUpdateSchema,
  scholarshipListQuerySchema,
  scholarshipRequirementsInputSchema,
  type ScholarshipStatus,
  scholarshipStatusChangeSchema,
  scholarshipUpdateSchema,
} from '@xcel/shared';
import { and, asc, count, desc, eq, getTableColumns, inArray, lt, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import {
  scholarshipCycles,
  scholarshipRequirements,
  scholarships,
  universities,
} from '../../db/schema';
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
  ValidationError,
} from '../../lib/http';
import { textSearch } from '../../lib/search';
import { uniqueSlug } from '../../lib/slug';
import { latestVerifications } from '../../lib/verification';
import { currentScholarshipCycles } from '../scholarships';
import { isCurrentlyVerified } from './verification';

const { searchVector: _, ...scholarshipColumns } = getTableColumns(scholarships);
type Scholarship = Omit<typeof scholarships.$inferSelect, 'searchVector'>;
type Cycle = typeof scholarshipCycles.$inferSelect;

async function findScholarship(db: Db, id: string): Promise<Scholarship> {
  const [row] = await db
    .select(scholarshipColumns)
    .from(scholarships)
    .where(eq(scholarships.id, id));
  if (!row) throw new NotFoundError('Scholarship not found');
  return row;
}

async function findCycle(db: Db, id: string): Promise<Cycle> {
  const [row] = await db.select().from(scholarshipCycles).where(eq(scholarshipCycles.id, id));
  if (!row) throw new NotFoundError('Scholarship cycle not found');
  return row;
}

async function latestCycle(db: Db, scholarshipId: string): Promise<Cycle | undefined> {
  const [row] = await db
    .select()
    .from(scholarshipCycles)
    .where(eq(scholarshipCycles.scholarshipId, scholarshipId))
    .orderBy(desc(scholarshipCycles.academicYear))
    .limit(1);
  return row;
}

async function assertUniversityExists(db: Db, universityId: string | null | undefined) {
  if (!universityId) return;
  const found = await db.$count(universities, eq(universities.id, universityId));
  if (!found) throw new ValidationError([{ path: 'universityId', message: 'No such university' }]);
}

/** Checks the SRS requirements for publishing a scholarship (sections 8 and 10). */
async function assertPublishable(db: Db, scholarship: Scholarship) {
  const cycle = await latestCycle(db, scholarship.id);
  if (!cycle) throw new ConflictError('Add a cycle with dates before publishing');
  if (cycle.closesOn && cycle.closesOn < ghanaToday()) {
    throw new ConflictError(`The ${cycle.academicYear} cycle has closed; add a new cycle first`);
  }
  if (!cycle.applicationUrl && !scholarship.providerUrl) {
    throw new ConflictError('Add an application URL or provider website before publishing');
  }
  if (!(await isCurrentlyVerified(db, 'scholarship_cycle', cycle.id))) {
    throw new ConflictError(
      `Verify the ${cycle.academicYear} cycle against a source before publishing`,
    );
  }
}

/** Changes a scholarship's status within a transaction, with an audit entry. */
async function changeStatus(
  db: Db,
  actorId: string | null,
  before: Scholarship,
  status: ScholarshipStatus,
) {
  const now = new Date();
  return audited(db, actorId, async (tx, audit) => {
    const [row] = await tx
      .update(scholarships)
      .set({
        status,
        ...(status === 'published' && { publishedAt: now }),
        ...(status === 'archived' && { archivedAt: now }),
        ...(before.status === 'archived' && { archivedAt: null }),
      })
      .where(eq(scholarships.id, before.id))
      .returning(scholarshipColumns);
    await audit({
      action: 'scholarship.status',
      entityType: 'scholarship',
      entityId: before.id,
      before: { status: before.status },
      after: { status },
    });
    return row!;
  });
}

export function scholarshipAdminRoutes(db: () => Db) {
  return (
    new Hono<AdminEnv>()
      .get('/scholarships', async (c) => {
        const query = parseQuery(c, scholarshipListQuerySchema);
        const current = currentScholarshipCycles(db());
        const conditions: SQL[] = [];
        let rank: SQL<number> | undefined;
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
        if (query.status) conditions.push(eq(scholarships.status, query.status));
        const where = conditions.length ? and(...conditions) : undefined;

        const [rows, total] = await Promise.all([
          db()
            .select({
              id: scholarships.id,
              slug: scholarships.slug,
              name: scholarships.name,
              providerName: scholarships.providerName,
              status: scholarships.status,
              updatedAt: scholarships.updatedAt,
              academicYear: current.academicYear,
              opensOn: current.opensOn,
              closesOn: current.closesOn,
            })
            .from(scholarships)
            .leftJoin(current, eq(current.scholarshipId, scholarships.id))
            .where(where)
            .orderBy(...(rank ? [desc(rank)] : []), asc(scholarships.name))
            .limit(paginate(query).limit)
            .offset(paginate(query).offset),
          countOf(db().select({ total: count() }).from(scholarships).where(where)),
        ]);
        const today = ghanaToday();
        return c.json<Paginated<AdminScholarshipListItem>>({
          items: rows.map(({ opensOn, ...r }) => ({
            ...r,
            updatedAt: r.updatedAt.toISOString(),
            availability: scholarshipAvailability(
              { status: r.status, opensOn, closesOn: r.closesOn },
              today,
            ),
          })),
          page: query.page,
          pageSize: query.pageSize,
          total,
        });
      })
      .post('/scholarships', async (c) => {
        const input = await parseJson(c, scholarshipCreateSchema);
        await assertUniversityExists(db(), input.universityId);
        const slug =
          input.slug ??
          (await uniqueSlug(
            input.name,
            async (s) => (await db().$count(scholarships, eq(scholarships.slug, s))) > 0,
          ));
        const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          const [row] = await tx
            .insert(scholarships)
            .values({ ...input, slug, status: 'draft' })
            .returning(scholarshipColumns);
          await audit({
            action: 'scholarship.create',
            entityType: 'scholarship',
            entityId: row!.id,
            after: row,
          });
          return row!;
        });
        return c.json(created, 201);
      })
      // Before /scholarships/:id so "expire-overdue" is not read as an id.
      .post('/scholarships/expire-overdue', async (c) => {
        const current = currentScholarshipCycles(db());
        const overdue = await db()
          .select(scholarshipColumns)
          .from(scholarships)
          .innerJoin(current, eq(current.scholarshipId, scholarships.id))
          .where(overdueCondition(current));
        for (const scholarship of overdue) {
          await changeStatus(db(), c.get('admin').user.id, scholarship, 'expired');
        }
        return c.json({ expired: overdue.map((s) => s.slug) });
      })
      .get('/scholarships/:id', async (c) => {
        const scholarship = await findScholarship(db(), uuidParam(c, 'id'));
        const cycles = await db()
          .select()
          .from(scholarshipCycles)
          .where(eq(scholarshipCycles.scholarshipId, scholarship.id))
          .orderBy(desc(scholarshipCycles.academicYear));
        const ids = cycles.map((cy) => cy.id);
        const [requirements, verifications] = await Promise.all([
          ids.length
            ? db()
                .select()
                .from(scholarshipRequirements)
                .where(inArray(scholarshipRequirements.cycleId, ids))
                .orderBy(asc(scholarshipRequirements.sortOrder))
            : [],
          latestVerifications(db(), 'scholarship_cycle', ids),
        ]);
        return c.json({
          ...scholarship,
          cycles: cycles.map((cy): AdminScholarshipCycle => ({
            id: cy.id,
            academicYear: cy.academicYear,
            opensOn: cy.opensOn,
            closesOn: cy.closesOn,
            applicationUrl: cy.applicationUrl,
            requirements: requirements.filter((r) => r.cycleId === cy.id).map((r) => r.description),
            lastVerifiedAt: verifications.get(cy.id)?.verifiedAt ?? null,
          })),
        });
      })
      .patch('/scholarships/:id', async (c) => {
        const before = await findScholarship(db(), uuidParam(c, 'id'));
        const input = await parseJson(c, scholarshipUpdateSchema);
        await assertUniversityExists(db(), input.universityId);
        const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          const [row] = await tx
            .update(scholarships)
            .set(input)
            .where(eq(scholarships.id, before.id))
            .returning(scholarshipColumns);
          await audit({
            action: 'scholarship.update',
            entityType: 'scholarship',
            entityId: before.id,
            before,
            after: row,
          });
          return row!;
        });
        return c.json(updated);
      })
      .post('/scholarships/:id/status', async (c) => {
        const before = await findScholarship(db(), uuidParam(c, 'id'));
        const { status } = await parseJson(c, scholarshipStatusChangeSchema);
        if (!SCHOLARSHIP_TRANSITIONS[before.status].includes(status)) {
          throw new ConflictError(`Cannot change status from ${before.status} to ${status}`);
        }
        if (status === 'published') await assertPublishable(db(), before);
        return c.json(await changeStatus(db(), c.get('admin').user.id, before, status));
      })
      .post('/scholarships/:id/cycles', async (c) => {
        const scholarship = await findScholarship(db(), uuidParam(c, 'id'));
        const input = await parseJson(c, scholarshipCycleCreateSchema);
        const created = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          const [row] = await tx
            .insert(scholarshipCycles)
            .values({ ...input, scholarshipId: scholarship.id })
            .returning();
          await audit({
            action: 'scholarship_cycle.create',
            entityType: 'scholarship_cycle',
            entityId: row!.id,
            after: row,
          });
          return row!;
        });
        return c.json(created, 201);
      })
      .patch('/scholarship-cycles/:id', async (c) => {
        const before = await findCycle(db(), uuidParam(c, 'id'));
        const input = await parseJson(c, scholarshipCycleUpdateSchema);
        const merged = { ...before, ...input };
        if (merged.opensOn && merged.closesOn && merged.opensOn > merged.closesOn) {
          throw new ValidationError([
            { path: 'closesOn', message: 'The opening date must be on or before the closing date' },
          ]);
        }
        const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          const [row] = await tx
            .update(scholarshipCycles)
            .set(input)
            .where(eq(scholarshipCycles.id, before.id))
            .returning();
          await audit({
            action: 'scholarship_cycle.update',
            entityType: 'scholarship_cycle',
            entityId: before.id,
            before,
            after: row,
          });
          return row!;
        });
        return c.json(updated);
      })
      .delete('/scholarship-cycles/:id', async (c) => {
        const before = await findCycle(db(), uuidParam(c, 'id'));
        const scholarship = await findScholarship(db(), before.scholarshipId);
        if (scholarship.status !== 'draft') {
          throw new ConflictError(
            'Cycles can only be deleted while the scholarship is a draft; history is kept',
          );
        }
        await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          await tx.delete(scholarshipCycles).where(eq(scholarshipCycles.id, before.id));
          await audit({
            action: 'scholarship_cycle.delete',
            entityType: 'scholarship_cycle',
            entityId: before.id,
            before,
          });
        });
        return c.body(null, 204);
      })
      .put('/scholarship-cycles/:id/requirements', async (c) => {
        const cycle = await findCycle(db(), uuidParam(c, 'id'));
        const { requirements } = await parseJson(c, scholarshipRequirementsInputSchema);
        await audited(db(), c.get('admin').user.id, async (tx, audit) => {
          const previous = await tx
            .select({ description: scholarshipRequirements.description })
            .from(scholarshipRequirements)
            .where(eq(scholarshipRequirements.cycleId, cycle.id))
            .orderBy(asc(scholarshipRequirements.sortOrder));
          await tx
            .delete(scholarshipRequirements)
            .where(eq(scholarshipRequirements.cycleId, cycle.id));
          if (requirements.length) {
            await tx.insert(scholarshipRequirements).values(
              requirements.map((r, i) => ({
                cycleId: cycle.id,
                description: r.description,
                sortOrder: i,
              })),
            );
          }
          await audit({
            action: 'scholarship_cycle.requirements',
            entityType: 'scholarship_cycle',
            entityId: cycle.id,
            before: previous.map((r) => r.description),
            after: requirements.map((r) => r.description),
          });
        });
        return c.json({ requirements: requirements.map((r) => r.description) });
      })
  );
}

/** Published scholarships whose current cycle's closing date has passed. */
function overdueCondition(current: ReturnType<typeof currentScholarshipCycles>) {
  return and(eq(scholarships.status, 'published'), lt(current.closesOn, ghanaToday()));
}

export function countOverdueScholarships(db: Db) {
  const current = currentScholarshipCycles(db);
  return countOf(
    db
      .select({ total: count() })
      .from(scholarships)
      .innerJoin(current, eq(current.scholarshipId, scholarships.id))
      .where(overdueCondition(current)),
  );
}
