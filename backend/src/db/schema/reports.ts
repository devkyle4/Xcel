import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, timestamptz } from './columns';
import { reportableEntityType, reportStatus } from './enums';
import { users } from './users';

/**
 * Public reports of incorrect information. Deliberately has no reporter
 * contact fields: the platform stores no student data.
 */
export const userReports = pgTable(
  'user_reports',
  {
    id: id(),
    entityType: reportableEntityType().notNull(),
    entityId: uuid().notNull(),
    message: text().notNull(),
    status: reportStatus().notNull().default('open'),
    adminNotes: text(),
    resolvedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamptz(),
    ...timestamps,
  },
  (t) => [
    index('user_reports_status_idx').on(t.status),
    index('user_reports_entity_idx').on(t.entityType, t.entityId),
    check('user_reports_message_length', sql`char_length(${t.message}) BETWEEN 1 AND 2000`),
  ],
);
