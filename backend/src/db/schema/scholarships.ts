import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { academicYearCheck, id, publicationTimestamps, timestamps, tsvector } from './columns';
import { scholarshipStatus, studyLevel } from './enums';
import { universities } from './universities';

/**
 * Base scholarship identity. A scholarship is shown as open only while its
 * current cycle's closing date has not passed, whatever `status` says.
 */
export const scholarships = pgTable(
  'scholarships',
  {
    id: id(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    providerName: text().notNull(),
    providerUrl: text(),
    /** The provider's logo: an https URL or a path under the site's /logos/ folder. */
    logoUrl: text(),
    universityId: uuid().references(() => universities.id, { onDelete: 'set null' }),
    description: text(),
    coverage: text(),
    studyLevels: studyLevel()
      .array()
      .notNull()
      .default(sql`'{}'`),
    fields: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    eligibilityCategories: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    location: text(),
    status: scholarshipStatus().notNull().default('draft'),
    ...publicationTimestamps,
    ...timestamps,
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(provider_name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
    ),
  },
  (t) => [
    index('scholarships_status_idx').on(t.status),
    index('scholarships_search_idx').using('gin', t.searchVector),
    index('scholarships_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
  ],
);

export const scholarshipCycles = pgTable(
  'scholarship_cycles',
  {
    id: id(),
    scholarshipId: uuid()
      .notNull()
      .references(() => scholarships.id, { onDelete: 'cascade' }),
    academicYear: text().notNull(),
    opensOn: date(),
    closesOn: date(),
    applicationUrl: text(),
    ...timestamps,
  },
  (t) => [
    unique('scholarship_cycles_scholarship_year_key').on(t.scholarshipId, t.academicYear),
    index('scholarship_cycles_closes_on_idx').on(t.closesOn),
    check('scholarship_cycles_academic_year_format', academicYearCheck('academic_year')),
    check(
      'scholarship_cycles_dates_ordered',
      sql`${t.opensOn} IS NULL OR ${t.closesOn} IS NULL OR ${t.opensOn} <= ${t.closesOn}`,
    ),
  ],
);

/**
 * Scholarship eligibility conditions: always a plain-language description,
 * optionally with a structured rule (ruleType + params) for future matching.
 */
export const scholarshipRequirements = pgTable(
  'scholarship_requirements',
  {
    id: id(),
    cycleId: uuid()
      .notNull()
      .references(() => scholarshipCycles.id, { onDelete: 'cascade' }),
    description: text().notNull(),
    ruleType: text(),
    params: jsonb().$type<Record<string, unknown>>(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('scholarship_requirements_cycle_idx').on(t.cycleId),
    check(
      'scholarship_requirements_rule_complete',
      sql`(${t.ruleType} IS NULL) = (${t.params} IS NULL)`,
    ),
  ],
);
