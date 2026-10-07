import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamptz = () => timestamp({ withTimezone: true });

export const timestamps = {
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Publication lifecycle timestamps for records that go through the publishing workflow. */
export const publicationTimestamps = {
  publishedAt: timestamptz(),
  archivedAt: timestamptz(),
};

export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

/** Check-constraint SQL for academic years such as "2026/2027". */
export const academicYearCheck = (column: string) =>
  sql.raw(
    // CASE guarantees the ::int casts only run on values that match the pattern.
    `CASE WHEN ${column} ~ '^[0-9]{4}/[0-9]{4}$' THEN substr(${column}, 6, 4)::int = substr(${column}, 1, 4)::int + 1 ELSE false END`,
  );
