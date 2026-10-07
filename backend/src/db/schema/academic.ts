import { boolean, check, pgTable, smallint, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from './columns';
import { subjectCategory } from './enums';

/** WASSCE subjects. `code` is stable and is what requirement rules reference. */
export const subjects = pgTable(
  'subjects',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull().unique(),
    category: subjectCategory().notNull(),
    /** Alternative names used by institutions, e.g. "Core Maths". Used for search and matching. */
    aliases: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [check('subjects_code_format', sql`${t.code} ~ '^[A-Z][A-Z0-9_]*$'`)],
);

/**
 * Grade catalogue with configurable ordering. `rank` 1 is the best grade;
 * "C6 or better" means rank <= rank(C6). `points` is the value used where a
 * rule calculates an aggregate.
 */
export const grades = pgTable(
  'grades',
  {
    id: id(),
    code: text().notNull().unique(),
    label: text().notNull(),
    rank: smallint().notNull().unique(),
    points: smallint(),
    isPass: boolean().notNull(),
    ...timestamps,
  },
  (t) => [
    check('grades_rank_positive', sql`${t.rank} > 0`),
    check('grades_points_positive', sql`${t.points} IS NULL OR ${t.points} > 0`),
  ],
);
