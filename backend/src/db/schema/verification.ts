import { check, date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { academicYearCheck, id, timestamps, timestamptz } from './columns';
import { verifiableEntityType, verificationStatus } from './enums';
import { users } from './users';

/** Where a piece of published information came from. */
export const sources = pgTable(
  'sources',
  {
    id: id(),
    url: text(),
    title: text().notNull(),
    publisher: text(),
    academicYear: text(),
    retrievedOn: date(),
    notes: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    check(
      'sources_academic_year_format',
      sql`${t.academicYear} IS NULL OR (${academicYearCheck('academic_year')})`,
    ),
  ],
);

/**
 * Verification history. Append a record for each verification; the latest one
 * for an entity gives its "Verified on" date and source.
 */
export const verificationRecords = pgTable(
  'verification_records',
  {
    id: id(),
    entityType: verifiableEntityType().notNull(),
    entityId: uuid().notNull(),
    sourceId: uuid().references(() => sources.id, { onDelete: 'restrict' }),
    status: verificationStatus().notNull(),
    verifiedAt: timestamptz().notNull().defaultNow(),
    verifiedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    notes: text(),
    ...timestamps,
  },
  (t) => [
    index('verification_records_entity_idx').on(t.entityType, t.entityId, t.verifiedAt.desc()),
    check(
      'verification_records_verified_needs_source',
      sql`${t.status} <> 'verified' OR ${t.sourceId} IS NOT NULL`,
    ),
  ],
);
