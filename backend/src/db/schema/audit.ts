import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './users';

/**
 * Append-only record of every admin write. A trigger (see migrations) rejects
 * UPDATE and DELETE on this table.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    occurredAt: timestamptz().notNull().defaultNow(),
    actorUserId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorUserId),
    index('audit_logs_occurred_at_idx').on(t.occurredAt.desc()),
  ],
);
