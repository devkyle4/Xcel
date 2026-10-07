import { index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './users';

/**
 * Admin sessions. `id` is the SHA-256 hash of the session token: the token
 * itself exists only in the admin's cookie, so a database leak cannot be
 * used to hijack sessions.
 */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz().notNull().defaultNow(),
    expiresAt: timestamptz().notNull(),
    lastSeenAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('admin_sessions_user_idx').on(t.userId),
    index('admin_sessions_expires_idx').on(t.expiresAt),
  ],
);

/**
 * Fixed-window request counters for rate limiting in a serverless setting.
 * Keys are HMACs of the identifier (IP address, email), never raw values.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text().notNull(),
    windowStart: timestamptz().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index('rate_limits_window_idx').on(t.windowStart),
  ],
);
