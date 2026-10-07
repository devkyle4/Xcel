import {
  type AdminReport,
  type Paginated,
  REPORT_TRANSITIONS,
  reportListQuerySchema,
  reportStatusChangeSchema,
} from '@xcel/shared';
import { and, count, desc, eq, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { programmes, scholarships, universities, userReports, users } from '../../db/schema';
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

const programmeUniversity = alias(universities, 'programme_university');

async function listReports(
  db: Db,
  where: SQL | undefined,
  page: { limit: number; offset: number },
) {
  const rows = await db
    .select({
      report: userReports,
      resolverName: users.name,
      universityName: universities.name,
      programmeName: programmes.name,
      programmeUniversity: programmeUniversity.name,
      scholarshipName: scholarships.name,
    })
    .from(userReports)
    .leftJoin(users, eq(users.id, userReports.resolvedBy))
    .leftJoin(
      universities,
      and(eq(userReports.entityType, 'university'), eq(universities.id, userReports.entityId)),
    )
    .leftJoin(
      programmes,
      and(eq(userReports.entityType, 'programme'), eq(programmes.id, userReports.entityId)),
    )
    .leftJoin(programmeUniversity, eq(programmeUniversity.id, programmes.universityId))
    .leftJoin(
      scholarships,
      and(eq(userReports.entityType, 'scholarship'), eq(scholarships.id, userReports.entityId)),
    )
    .where(where)
    .orderBy(
      // Unresolved reports first, oldest first, so nothing waits too long.
      sql`${userReports.status} IN ('resolved', 'dismissed')`,
      sql`CASE WHEN ${userReports.status} IN ('open', 'under_review') THEN ${userReports.createdAt} END ASC`,
      desc(userReports.createdAt),
    )
    .limit(page.limit)
    .offset(page.offset);

  return rows.map(({ report: r, ...names }): AdminReport => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    entityLabel:
      names.universityName ??
      (names.programmeName ? `${names.programmeName}, ${names.programmeUniversity}` : null) ??
      names.scholarshipName,
    message: r.message,
    status: r.status,
    adminNotes: r.adminNotes,
    resolvedBy: r.resolvedBy ? { id: r.resolvedBy, name: names.resolverName! } : null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function reportAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const query = parseQuery(c, reportListQuerySchema);
      const conditions: SQL[] = [];
      if (query.status) conditions.push(eq(userReports.status, query.status));
      if (query.entityType) conditions.push(eq(userReports.entityType, query.entityType));
      const where = conditions.length ? and(...conditions) : undefined;
      const [items, total] = await Promise.all([
        listReports(db(), where, paginate(query)),
        countOf(db().select({ total: count() }).from(userReports).where(where)),
      ]);
      return c.json<Paginated<AdminReport>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .get('/:id', async (c) => {
      const [report] = await listReports(db(), eq(userReports.id, uuidParam(c, 'id')), {
        limit: 1,
        offset: 0,
      });
      if (!report) throw new NotFoundError('Report not found');
      return c.json(report);
    })
    .post('/:id/status', async (c) => {
      const id = uuidParam(c, 'id');
      const [before] = await db().select().from(userReports).where(eq(userReports.id, id));
      if (!before) throw new NotFoundError('Report not found');
      const { status, adminNotes } = await parseJson(c, reportStatusChangeSchema);
      if (!REPORT_TRANSITIONS[before.status].includes(status)) {
        throw new ConflictError(`Cannot change a report from ${before.status} to ${status}`);
      }
      const actorId = c.get('admin').user.id;
      const closing = status === 'resolved' || status === 'dismissed';
      await audited(db(), actorId, async (tx, audit) => {
        await tx
          .update(userReports)
          .set({
            status,
            ...(adminNotes !== undefined && { adminNotes }),
            resolvedBy: closing ? actorId : null,
            resolvedAt: closing ? new Date() : null,
          })
          .where(eq(userReports.id, id));
        await audit({
          action: 'report.status',
          entityType: 'report',
          entityId: id,
          before: { status: before.status, adminNotes: before.adminNotes },
          after: { status, adminNotes: adminNotes === undefined ? before.adminNotes : adminNotes },
        });
      });
      const [report] = await listReports(db(), eq(userReports.id, id), { limit: 1, offset: 0 });
      return c.json(report!);
    });
}
