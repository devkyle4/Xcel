import { sql } from 'drizzle-orm';
import { index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, publicationTimestamps, timestamps, tsvector } from './columns';
import { ghanaRegion, institutionType, publishStatus } from './enums';

export const universities = pgTable(
  'universities',
  {
    id: id(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    shortName: text(),
    institutionType: institutionType().notNull(),
    region: ghanaRegion(),
    town: text(),
    description: text(),
    websiteUrl: text(),
    admissionsUrl: text(),
    logoUrl: text(),
    status: publishStatus().notNull().default('draft'),
    ...publicationTimestamps,
    ...timestamps,
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(short_name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
    ),
  },
  (t) => [
    index('universities_status_idx').on(t.status),
    index('universities_search_idx').using('gin', t.searchVector),
    index('universities_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
  ],
);

export const facultySchools = pgTable(
  'faculty_schools',
  {
    id: id(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [unique('faculty_schools_university_name_key').on(t.universityId, t.name)],
);
