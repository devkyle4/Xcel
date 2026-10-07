import { z } from 'zod';
import {
  type PublishStatus,
  REPORT_STATUSES,
  REPORTABLE_ENTITY_TYPES,
  type ReportableEntityType,
  type ReportStatus,
  SCHOLARSHIP_STATUSES,
  type ScholarshipStatus,
  STUDY_LEVELS,
  SUBJECT_CATEGORIES,
  type SubjectCategory,
} from '../domain';
import { adminListQuerySchema, slugSchema } from './admin-content';
import { academicYearSchema, paginationQuerySchema } from './queries';
import type { ScholarshipAvailability } from './scholarships';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
const url = z
  .url({ protocol: /^https?$/, message: 'Enter a full http:// or https:// URL' })
  .max(2048)
  .nullable()
  .optional();
const isoDate = z.iso.date().nullable().optional();
/** Short labels such as fields or eligibility categories; trimmed and de-duplicated. */
const labels = z
  .array(z.string().trim().min(1).max(60))
  .max(20)
  .transform((v) => [...new Set(v)]);
const NO_FIELDS = { message: 'Provide at least one field to change' };
const nonEmpty = (v: object) => Object.keys(v).length > 0;

// ---------- Scholarships ----------

const scholarshipFields = {
  name: z.string().trim().min(2).max(200),
  slug: slugSchema.optional(),
  providerName: z.string().trim().min(2).max(200),
  providerUrl: url,
  universityId: z.uuid().nullable().optional(),
  description: text(5000),
  coverage: text(1000),
  studyLevels: z.array(z.enum(STUDY_LEVELS)).max(STUDY_LEVELS.length).optional(),
  fields: labels.optional(),
  eligibilityCategories: labels.optional(),
  location: text(100),
};
export const scholarshipCreateSchema = z.object(scholarshipFields).strict();
export const scholarshipUpdateSchema = z
  .object(scholarshipFields)
  .partial()
  .strict()
  .refine(nonEmpty, NO_FIELDS);

export const scholarshipListQuerySchema = paginationQuerySchema.extend({
  q: adminListQuerySchema.shape.q,
  status: z.enum(SCHOLARSHIP_STATUSES).optional(),
});

export const scholarshipStatusChangeSchema = z
  .object({ status: z.enum(SCHOLARSHIP_STATUSES) })
  .strict();

const scholarshipCycleFields = {
  academicYear: academicYearSchema,
  opensOn: isoDate,
  closesOn: isoDate,
  applicationUrl: url,
};
const datesInOrder = (v: { opensOn?: string | null; closesOn?: string | null }) =>
  !v.opensOn || !v.closesOn || v.opensOn <= v.closesOn;
const DATES = {
  message: 'The opening date must be on or before the closing date',
  path: ['closesOn'],
};
export const scholarshipCycleCreateSchema = z
  .object(scholarshipCycleFields)
  .strict()
  .refine(datesInOrder, DATES);
export const scholarshipCycleUpdateSchema = z
  .object(scholarshipCycleFields)
  .partial()
  .strict()
  .refine(nonEmpty, NO_FIELDS)
  .refine(datesInOrder, DATES);

export const scholarshipRequirementsInputSchema = z
  .object({
    requirements: z
      .array(z.object({ description: z.string().trim().min(2).max(1000) }).strict())
      .max(50),
  })
  .strict();

export interface AdminScholarshipCycle {
  id: string;
  academicYear: string;
  opensOn: string | null;
  closesOn: string | null;
  applicationUrl: string | null;
  requirements: string[];
  lastVerifiedAt: string | null;
}

// ---------- Subjects and grades ----------

export const subjectCodeSchema = z
  .string()
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE, e.g. ELECTIVE_MATHS');

const aliases = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .transform((v) => [...new Set(v)]);

export const subjectCreateSchema = z
  .object({
    code: subjectCodeSchema,
    name: z.string().trim().min(2).max(100),
    category: z.enum(SUBJECT_CATEGORIES),
    aliases: aliases.optional(),
  })
  .strict();
/** The code is permanent: requirement rules refer to subjects by code. */
export const subjectUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    category: z.enum(SUBJECT_CATEGORIES),
    aliases,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NO_FIELDS);

export interface AdminSubject {
  code: string;
  name: string;
  category: SubjectCategory;
  aliases: string[];
  isActive: boolean;
  /** Number of requirement rules (in any cycle) that refer to this subject. */
  usedByRules: number;
}

export const gradeCodeSchema = z
  .string()
  .max(8)
  .regex(/^[A-Z0-9]+$/, 'Use capital letters and digits, e.g. C6');

export const gradeCreateSchema = z
  .object({
    code: gradeCodeSchema,
    label: z.string().trim().min(1).max(40),
    points: z.int().min(1).max(100).nullable().optional(),
    isPass: z.boolean(),
  })
  .strict();
export const gradeUpdateSchema = gradeCreateSchema
  .omit({ code: true })
  .partial()
  .strict()
  .refine(nonEmpty, NO_FIELDS);
/** The complete grade order, best first. */
export const gradeOrderSchema = z
  .object({ codes: z.array(gradeCodeSchema).min(1).max(50) })
  .strict()
  .refine((v) => new Set(v.codes).size === v.codes.length, { message: 'List each grade once' });

export interface AdminGrade {
  code: string;
  label: string;
  rank: number;
  points: number | null;
  isPass: boolean;
  usedByRules: number;
}

// ---------- User reports ----------

/** Public report of incorrect information. Deliberately has no contact fields. */
export const reportCreateSchema = z.discriminatedUnion('entityType', [
  z
    .object({
      entityType: z.literal('programme'),
      entityId: z.uuid(),
      message: z.string().trim().min(10).max(2000),
    })
    .strict(),
  z
    .object({
      entityType: z.enum(['university', 'scholarship']),
      slug: slugSchema,
      message: z.string().trim().min(10).max(2000),
    })
    .strict(),
]);
export type ReportCreateInput = z.input<typeof reportCreateSchema>;

export const reportListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
  entityType: z.enum(REPORTABLE_ENTITY_TYPES).optional(),
});

export const reportStatusChangeSchema = z
  .object({ status: z.enum(REPORT_STATUSES), adminNotes: text(2000) })
  .strict();

export interface AdminReport {
  id: string;
  entityType: ReportableEntityType;
  entityId: string;
  /** Name of the reported record, or null if it no longer exists. */
  entityLabel: string | null;
  message: string;
  status: ReportStatus;
  adminNotes: string | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ---------- Dashboard ----------

export interface AdminDashboard {
  universities: Partial<Record<PublishStatus, number>>;
  programmes: Partial<Record<PublishStatus, number>>;
  admissionCycles: Partial<Record<PublishStatus, number>>;
  scholarships: Partial<Record<ScholarshipStatus, number>> & {
    /** Published, but the current cycle's closing date has passed. */
    overdue: number;
  };
  mentors: { active: number; inactive: number; archived: number };
  openReports: number;
  staleRecords: number;
}

export interface AdminScholarshipListItem {
  id: string;
  slug: string;
  name: string;
  providerName: string;
  status: ScholarshipStatus;
  academicYear: string | null;
  closesOn: string | null;
  availability: ScholarshipAvailability;
  updatedAt: string;
}
