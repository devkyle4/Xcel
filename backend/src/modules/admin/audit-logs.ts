import { type AuditLogEntry, auditLogQuerySchema, type Paginated } from '@xcel/shared';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { auditLogs, users } from '../../db/schema';
import type { AdminEnv } from '../../lib/auth/middleware';
import { countOf, paginate, parseQuery } from '../../lib/http';

/** Read-only audit log viewer, newest first. */
export function auditLogRoutes(db: () => Db) {
  return new Hono<AdminEnv>().get('/', async (c) => {
    const query = parseQuery(c, auditLogQuerySchema);
    const conditions: SQL[] = [];
    if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));
    if (query.actorUserId) conditions.push(eq(auditLogs.actorUserId, query.actorUserId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db()
        .select({
          id: auditLogs.id,
          occurredAt: auditLogs.occurredAt,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          before: auditLogs.before,
          after: auditLogs.after,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorUserId))
        .where(where)
        .orderBy(desc(auditLogs.id))
        .limit(paginate(query).limit)
        .offset(paginate(query).offset),
      countOf(db().select({ total: count() }).from(auditLogs).where(where)),
    ]);

    return c.json<Paginated<AuditLogEntry>>({
      items: rows.map(({ actorId, actorName, actorEmail, occurredAt, ...row }) => ({
        ...row,
        occurredAt: occurredAt.toISOString(),
        actor: actorId ? { id: actorId, name: actorName!, email: actorEmail! } : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  });
}
