import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { id, timestamps, timestamptz } from './columns';
import { userRole } from './enums';

/** Administrator accounts. There are no student accounts. */
export const users = pgTable(
  'users',
  {
    id: id(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    role: userRole().notNull().default('admin'),
    isActive: boolean().notNull().default(true),
    lastLoginAt: timestamptz(),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)],
);
