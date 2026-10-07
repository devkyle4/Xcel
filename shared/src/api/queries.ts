import { z } from 'zod';
import {
  DEGREE_TYPES,
  GHANA_REGIONS,
  INSTITUTION_TYPES,
  isValidAcademicYear,
  STUDY_LEVELS,
} from '../domain';
import { SCHOLARSHIP_AVAILABILITIES } from './scholarships';

/** Optional free-text parameter: trimmed, and treated as absent when empty. */
const text = (max = 100) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const academicYearSchema = z
  .string()
  .refine(isValidAcademicYear, { message: 'Academic year must look like 2026/2027' });

export const universityQuerySchema = paginationQuerySchema.extend({
  q: text(),
  region: z.enum(GHANA_REGIONS).optional(),
  type: z.enum(INSTITUTION_TYPES).optional(),
});
export type UniversityQuery = z.input<typeof universityQuerySchema>;

export const programmeQuerySchema = paginationQuerySchema.extend({
  q: text(),
  /** University slug. */
  university: text(),
  field: text(),
  degreeType: z.enum(DEGREE_TYPES).optional(),
  region: z.enum(GHANA_REGIONS).optional(),
});
export type ProgrammeQuery = z.input<typeof programmeQuerySchema>;

export const programmeDetailQuerySchema = z.object({
  /** Admission year to show; defaults to the latest published year. */
  year: academicYearSchema.optional(),
});

export const scholarshipQuerySchema = paginationQuerySchema.extend({
  q: text(),
  studyLevel: z.enum(STUDY_LEVELS).optional(),
  field: text(),
  category: text(),
  location: text(),
  /** Comma-separated availabilities, e.g. "open,upcoming". */
  availability: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const values = [...new Set(v.split(',').map((s) => s.trim()))];
      for (const value of values) {
        if (!(SCHOLARSHIP_AVAILABILITIES as readonly string[]).includes(value)) {
          ctx.addIssue({ code: 'custom', message: `Unknown availability "${value}"` });
          return z.NEVER;
        }
      }
      return values as (typeof SCHOLARSHIP_AVAILABILITIES)[number][];
    }),
});
export type ScholarshipQuery = z.input<typeof scholarshipQuerySchema>;
