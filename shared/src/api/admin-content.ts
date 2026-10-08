import { z } from 'zod';
import {
  DEGREE_TYPES,
  type DegreeType,
  GHANA_REGIONS,
  type GhanaRegion,
  INSTITUTION_TYPES,
  type InstitutionType,
  PUBLISH_STATUSES,
  type PublishStatus,
  type ScholarshipStatus,
  VERIFIABLE_ENTITY_TYPES,
  type VerifiableEntityType,
  VERIFICATION_STATUSES,
  type VerificationStatus,
} from '../domain';
import { academicYearSchema, paginationQuerySchema } from './queries';

// Admin input schemas. On update, an absent field is left unchanged and null clears it.

/** Optional text: trimmed; empty becomes null. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

/** Only http(s) URLs, so stored links can never be "javascript:" etc. */
const url = z
  .url({ protocol: /^https?$/, message: 'Enter a full http:// or https:// URL' })
  .max(2048)
  .nullable()
  .optional();

export const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

const isoDate = z.iso.date().nullable().optional();

const atLeastOneField = (value: object) => Object.keys(value).length > 0;
const NO_FIELDS = { message: 'Provide at least one field to change' };

export const adminListQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(PUBLISH_STATUSES).optional(),
});

export const statusChangeSchema = z.object({ status: z.enum(PUBLISH_STATUSES) }).strict();

const universityFields = {
  name: z.string().trim().min(2).max(200),
  slug: slugSchema.optional(),
  shortName: text(50),
  institutionType: z.enum(INSTITUTION_TYPES),
  region: z.enum(GHANA_REGIONS).nullable().optional(),
  town: text(100),
  description: text(5000),
  websiteUrl: url,
  admissionsUrl: url,
  logoUrl: url,
};
export const universityCreateSchema = z.object(universityFields).strict();
export const universityUpdateSchema = z
  .object(universityFields)
  .partial()
  .strict()
  .refine(atLeastOneField, NO_FIELDS);
export type UniversityCreateInput = z.input<typeof universityCreateSchema>;

export const facultySchoolInputSchema = z
  .object({ name: z.string().trim().min(2).max(200) })
  .strict();

const programmeFields = {
  universityId: z.uuid(),
  facultySchoolId: z.uuid().nullable().optional(),
  slug: slugSchema.optional(),
  name: z.string().trim().min(2).max(200),
  field: text(100),
  degreeType: z.enum(DEGREE_TYPES),
  durationYears: z.int().min(1).max(10).nullable().optional(),
  campus: text(100),
  description: text(5000),
};
export const programmeCreateSchema = z.object(programmeFields).strict();
/** A programme cannot move to another university; create a new one instead. */
export const programmeUpdateSchema = z
  .object(programmeFields)
  .omit({ universityId: true })
  .partial()
  .strict()
  .refine(atLeastOneField, NO_FIELDS);
export type ProgrammeCreateInput = z.input<typeof programmeCreateSchema>;

export const programmeListQuerySchema = adminListQuerySchema.extend({
  universityId: z.uuid().optional(),
});

const sourceFields = {
  title: z.string().trim().min(2).max(300),
  url,
  publisher: text(200),
  academicYear: academicYearSchema.nullable().optional(),
  retrievedOn: isoDate,
  notes: text(2000),
};
export const sourceCreateSchema = z.object(sourceFields).strict();
export const sourceUpdateSchema = z
  .object(sourceFields)
  .partial()
  .strict()
  .refine(atLeastOneField, NO_FIELDS);

export const verificationCreateSchema = z
  .object({
    entityType: z.enum(VERIFIABLE_ENTITY_TYPES),
    entityId: z.uuid(),
    sourceId: z.uuid().nullable().optional(),
    status: z.enum(VERIFICATION_STATUSES),
    notes: text(2000),
    /** Defaults to now. */
    verifiedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((v) => v.status !== 'verified' || v.sourceId, {
    message: 'A verified record needs a source',
    path: ['sourceId'],
  });

export const verificationListQuerySchema = paginationQuerySchema.extend({
  entityType: z.enum(VERIFIABLE_ENTITY_TYPES).optional(),
  entityId: z.uuid().optional(),
});

export const settingsUpdateSchema = z.object({ staleAfterDays: z.int().min(1).max(3650) }).strict();

// ---------- Admin responses ----------

export interface AdminVerificationRecord {
  id: string;
  entityType: VerifiableEntityType;
  entityId: string;
  /** Name of what was checked, e.g. "BSc. Nursing (2026/2027)"; null if it no longer exists. */
  entityLabel: string | null;
  /** Where it is edited: the university, or the cycle's programme or scholarship. */
  ownerId: string | null;
  status: VerificationStatus;
  verifiedAt: string;
  notes: string | null;
  verifiedBy: { id: string; name: string } | null;
  source: { id: string; title: string; url: string | null; academicYear: string | null } | null;
}

export interface StaleRecord {
  entityType: VerifiableEntityType;
  entityId: string;
  label: string;
  /** Where it is edited: the university, or the cycle's programme or scholarship. */
  ownerId: string;
  status: PublishStatus | ScholarshipStatus;
  /** Null if never verified. */
  lastVerifiedAt: string | null;
}

export interface StaleReport {
  staleAfterDays: number;
  items: StaleRecord[];
}

export interface PlatformSettings {
  staleAfterDays: number;
}

// JSON shapes of the admin catalogue endpoints (timestamps are ISO strings).

interface PublicationFields {
  status: PublishStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUniversity extends PublicationFields {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  institutionType: InstitutionType;
  region: GhanaRegion | null;
  town: string | null;
  description: string | null;
  websiteUrl: string | null;
  admissionsUrl: string | null;
  logoUrl: string | null;
}

export interface AdminFacultySchool {
  id: string;
  universityId: string;
  name: string;
}

export interface AdminUniversityDetail extends AdminUniversity {
  facultySchools: AdminFacultySchool[];
  verifications: AdminVerificationRecord[];
}

export interface AdminProgramme extends PublicationFields {
  id: string;
  universityId: string;
  facultySchoolId: string | null;
  slug: string;
  name: string;
  field: string | null;
  degreeType: DegreeType;
  durationYears: number | null;
  campus: string | null;
  description: string | null;
}

export interface AdminProgrammeListItem extends AdminProgramme {
  universityName: string;
}

export interface AdminProgrammeDetail extends AdminProgramme {
  university: { id: string; name: string; slug: string; status: PublishStatus };
  admissionCycles: {
    id: string;
    academicYear: string;
    version: number;
    status: PublishStatus;
    verifiedAt: string | null;
    publishedAt: string | null;
  }[];
}

export interface AdminSource {
  id: string;
  url: string | null;
  title: string;
  publisher: string | null;
  academicYear: string | null;
  retrievedOn: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
