import {
  adminListQuerySchema,
  type Paginated,
  sourceCreateSchema,
  sourceUpdateSchema,
} from '@xcel/shared';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../../db/client';
import { sources } from '../../db/schema';
import { audited } from '../../lib/audit';
import type { AdminEnv } from '../../lib/auth/middleware';
import { countOf, NotFoundError, paginate, parseJson, parseQuery, uuidParam } from '../../lib/http';
import { escapeLike } from '../../lib/search';

type Source = typeof sources.$inferSelect;

async function findSource(db: Db, id: string): Promise<Source> {
  const [row] = await db.select().from(sources).where(eq(sources.id, id));
  if (!row) throw new NotFoundError('Source not found');
  return row;
}

/** Sources are kept for the record; there is no delete. */
export function sourceAdminRoutes(db: () => Db) {
  return new Hono<AdminEnv>()
    .get('/', async (c) => {
      const query = parseQuery(c, adminListQuerySchema.omit({ status: true }));
      const pattern = query.q && `%${escapeLike(query.q)}%`;
      const where = pattern
        ? or(
            ilike(sources.title, pattern),
            ilike(sources.publisher, pattern),
            ilike(sources.url, pattern),
          )
        : undefined;
      const [items, total] = await Promise.all([
        db()
          .select()
          .from(sources)
          .where(where)
          .orderBy(desc(sources.createdAt))
          .limit(paginate(query).limit)
          .offset(paginate(query).offset),
        countOf(db().select({ total: count() }).from(sources).where(where)),
      ]);
      return c.json<Paginated<Source>>({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
      });
    })
    .post('/', async (c) => {
      const input = await parseJson(c, sourceCreateSchema);
      const actorId = c.get('admin').user.id;
      const created = await audited(db(), actorId, async (tx, audit) => {
        const [row] = await tx
          .insert(sources)
          .values({ ...input, createdBy: actorId })
          .returning();
        await audit({
          action: 'source.create',
          entityType: 'source',
          entityId: row!.id,
          after: row,
        });
        return row!;
      });
      return c.json(created, 201);
    })
    .get('/:id', async (c) => c.json(await findSource(db(), uuidParam(c, 'id'))))
    .patch('/:id', async (c) => {
      const before = await findSource(db(), uuidParam(c, 'id'));
      const input = await parseJson(c, sourceUpdateSchema);
      const updated = await audited(db(), c.get('admin').user.id, async (tx, audit) => {
        const [row] = await tx
          .update(sources)
          .set(input)
          .where(eq(sources.id, before.id))
          .returning();
        await audit({
          action: 'source.update',
          entityType: 'source',
          entityId: before.id,
          before,
          after: row,
        });
        return row!;
      });
      return c.json(updated);
    });
}
