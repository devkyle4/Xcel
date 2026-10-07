import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  academicYearCheck,
  id,
  publicationTimestamps,
  timestamps,
  timestamptz,
  tsvector,
} from './columns';
import { degreeType, publishStatus, requirementOperator } from './enums';
import { facultySchools, universities } from './universities';

/** Base programme identity. Requirements live on admission cycles, never here. */
export const programmes = pgTable(
  'programmes',
  {
    id: id(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: 'restrict' }),
    facultySchoolId: uuid().references(() => facultySchools.id, { onDelete: 'set null' }),
    slug: text().notNull(),
    name: text().notNull(),
    field: text(),
    degreeType: degreeType().notNull(),
    durationYears: smallint(),
    campus: text(),
    description: text(),
    status: publishStatus().notNull().default('draft'),
    ...publicationTimestamps,
    ...timestamps,
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(field, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
    ),
  },
  (t) => [
    unique('programmes_university_slug_key').on(t.universityId, t.slug),
    index('programmes_university_idx').on(t.universityId),
    index('programmes_status_idx').on(t.status),
    index('programmes_search_idx').using('gin', t.searchVector),
    index('programmes_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    check(
      'programmes_duration_positive',
      sql`${t.durationYears} IS NULL OR ${t.durationYears} > 0`,
    ),
  ],
);

/**
 * Academic-year-specific programme information. Changing a published cycle
 * creates a new version (supersedesCycleId -> previous) instead of editing it.
 */
export const programmeAdmissionCycles = pgTable(
  'programme_admission_cycles',
  {
    id: id(),
    programmeId: uuid()
      .notNull()
      .references(() => programmes.id, { onDelete: 'restrict' }),
    academicYear: text().notNull(),
    version: integer().notNull().default(1),
    supersedesCycleId: uuid(),
    applicationOpensOn: date(),
    applicationDeadline: date(),
    applicationUrl: text(),
    notes: text(),
    status: publishStatus().notNull().default('draft'),
    verifiedAt: timestamptz(),
    ...publicationTimestamps,
    ...timestamps,
  },
  (t) => [
    unique('programme_cycles_programme_year_version_key').on(
      t.programmeId,
      t.academicYear,
      t.version,
    ),
    // At most one published version of a programme's requirements per academic year.
    uniqueIndex('programme_cycles_one_published_per_year_idx')
      .on(t.programmeId, t.academicYear)
      .where(sql`${t.status} = 'published'`),
    // Named explicitly: the generated name exceeds Postgres's 63-character limit.
    foreignKey({
      name: 'programme_cycles_supersedes_fk',
      columns: [t.supersedesCycleId],
      foreignColumns: [t.id],
    }).onDelete('set null'),
    check('programme_cycles_academic_year_format', academicYearCheck('academic_year')),
    check('programme_cycles_version_positive', sql`${t.version} > 0`),
    check(
      'programme_cycles_dates_ordered',
      sql`${t.applicationOpensOn} IS NULL OR ${t.applicationDeadline} IS NULL OR ${t.applicationOpensOn} <= ${t.applicationDeadline}`,
    ),
  ],
);

/**
 * A node in a cycle's requirement tree. Each cycle has exactly one root group
 * (parentGroupId null). `at_least` groups need minCount ("any N of").
 */
export const requirementGroups = pgTable(
  'requirement_groups',
  {
    id: id(),
    cycleId: uuid()
      .notNull()
      .references(() => programmeAdmissionCycles.id, { onDelete: 'cascade' }),
    parentGroupId: uuid(),
    operator: requirementOperator().notNull(),
    minCount: smallint(),
    label: text(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique('requirement_groups_id_cycle_key').on(t.id, t.cycleId),
    // A child group must belong to the same cycle as its parent.
    foreignKey({
      name: 'requirement_groups_parent_same_cycle_fk',
      columns: [t.parentGroupId, t.cycleId],
      foreignColumns: [t.id, t.cycleId],
    }).onDelete('cascade'),
    uniqueIndex('requirement_groups_one_root_per_cycle_idx')
      .on(t.cycleId)
      .where(sql`${t.parentGroupId} IS NULL`),
    index('requirement_groups_parent_idx').on(t.parentGroupId),
    check(
      'requirement_groups_min_count_matches_operator',
      sql`(${t.operator} = 'at_least' AND ${t.minCount} IS NOT NULL AND ${t.minCount} >= 1) OR (${t.operator} <> 'at_least' AND ${t.minCount} IS NULL)`,
    ),
    check(
      'requirement_groups_not_own_parent',
      sql`${t.parentGroupId} IS NULL OR ${t.parentGroupId} <> ${t.id}`,
    ),
  ],
);

/**
 * A single requirement. `ruleType` plus `params` (validated in the shared
 * package per rule type) keeps rule types extensible without migrations.
 * Rules reference subjects and grades by their stable codes.
 */
export const requirementRules = pgTable(
  'requirement_rules',
  {
    id: id(),
    groupId: uuid()
      .notNull()
      .references(() => requirementGroups.id, { onDelete: 'cascade' }),
    ruleType: text().notNull(),
    params: jsonb().notNull().$type<Record<string, unknown>>(),
    label: text(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('requirement_rules_group_idx').on(t.groupId),
    check('requirement_rules_type_format', sql`${t.ruleType} ~ '^[a-z][a-z0-9_]*$'`),
    check('requirement_rules_params_object', sql`jsonb_typeof(${t.params}) = 'object'`),
  ],
);
