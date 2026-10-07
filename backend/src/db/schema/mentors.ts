import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, timestamptz } from './columns';
import { mentorExpertiseKind, mentorStatus } from './enums';

/**
 * Mentor profiles, added by the administrator (no separate verification step).
 * `contactEmail` is private: never select it into a public API response.
 * Only `active` mentors are shown publicly and can receive requests.
 */
export const mentors = pgTable('mentors', {
  id: id(),
  slug: text().notNull().unique(),
  fullName: text().notNull(),
  headline: text(),
  photoUrl: text(),
  bio: text(),
  background: text(),
  contactEmail: text().notNull(),
  status: mentorStatus().notNull().default('inactive'),
  archivedAt: timestamptz(),
  ...timestamps,
});

/** Topics (codes from MENTORING_TOPICS), fields and programme areas a mentor covers. */
export const mentorExpertise = pgTable(
  'mentor_expertise',
  {
    id: id(),
    mentorId: uuid()
      .notNull()
      .references(() => mentors.id, { onDelete: 'cascade' }),
    kind: mentorExpertiseKind().notNull(),
    value: text().notNull(),
    ...timestamps,
  },
  (t) => [unique('mentor_expertise_mentor_kind_value_key').on(t.mentorId, t.kind, t.value)],
);

/** Monthly counts of session requests per mentor. Counts only, no request content. */
export const mentorRequestStats = pgTable(
  'mentor_request_stats',
  {
    mentorId: uuid()
      .notNull()
      .references(() => mentors.id, { onDelete: 'cascade' }),
    month: date().notNull(),
    sentCount: integer().notNull().default(0),
    failedCount: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.mentorId, t.month] }),
    check('mentor_request_stats_month_start', sql`extract(day from ${t.month}) = 1`),
  ],
);
