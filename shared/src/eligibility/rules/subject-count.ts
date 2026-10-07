import { z } from 'zod';
import { SUBJECT_CATEGORIES } from '../../domain';
import { codeSchema, defineRule, qualifyingSubjects, subjectCodesSchema } from './define';

/**
 * Any N distinct subjects at a minimum grade, drawn from a list, a category,
 * or all subjects, e.g. "credit passes in any three elective subjects".
 */
export const subjectCountRule = defineRule(
  'subject_count',
  z
    .object({
      count: z.int().min(1),
      minGrade: codeSchema,
      subjectCodes: subjectCodesSchema.optional(),
      category: z.enum(SUBJECT_CATEGORIES).optional(),
      excludeSubjectCodes: z.array(codeSchema).optional(),
    })
    .strict()
    .refine((p) => !(p.subjectCodes && p.category), {
      message: 'Use either subjectCodes or category, not both',
    }),
  {
    referencedCodes: (p) => ({
      subjects: [...(p.subjectCodes ?? []), ...(p.excludeSubjectCodes ?? [])],
      grades: [p.minGrade],
    }),
    evaluate(p, context) {
      const excluded = new Set(p.excludeSubjectCodes ?? []);
      const pool = (p.subjectCodes ?? context.catalogue.subjectCodes(p.category)).filter(
        (code) => !excluded.has(code),
      );
      const qualifying = qualifyingSubjects(pool, p.minGrade, context);
      const satisfied = qualifying.length >= p.count;
      return {
        outcome: satisfied ? 'satisfied' : 'unsatisfied',
        reason: satisfied ? null : 'not_enough_subjects',
        explanation: {
          type: 'subject_count',
          minGrade: p.minGrade,
          count: p.count,
          acceptedSubjects: p.subjectCodes ?? null,
          category: p.category ?? null,
          excludedSubjects: p.excludeSubjectCodes ?? [],
          qualifying,
        },
        allocation: { candidates: qualifying.map((s) => s.subjectCode), required: p.count },
      };
    },
  },
);
