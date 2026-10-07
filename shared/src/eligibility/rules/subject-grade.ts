import { z } from 'zod';
import { codeSchema, defineRule, qualifyingSubjects, subjectCodesSchema } from './define';

/**
 * A minimum grade in one subject, or in any one of several equivalent or
 * alternative subjects, e.g. "C6 or better in Chemistry or Biology".
 */
export const subjectGradeRule = defineRule(
  'subject_grade',
  z.object({ subjectCodes: subjectCodesSchema, minGrade: codeSchema }).strict(),
  {
    referencedCodes: (p) => ({ subjects: p.subjectCodes, grades: [p.minGrade] }),
    evaluate(p, context) {
      const studentGrades = p.subjectCodes.map((subjectCode) => ({
        subjectCode,
        gradeCode: context.results[subjectCode] ?? null,
      }));
      const candidates = qualifyingSubjects(p.subjectCodes, p.minGrade, context).map(
        (s) => s.subjectCode,
      );
      const taken = studentGrades.some((g) => g.gradeCode !== null);
      const satisfied = candidates.length > 0;
      return {
        outcome: satisfied ? 'satisfied' : 'unsatisfied',
        reason: satisfied ? null : taken ? 'grade_too_low' : 'not_taken',
        explanation: {
          type: 'subject_grade',
          minGrade: p.minGrade,
          acceptedSubjects: p.subjectCodes,
          studentGrades,
        },
        allocation: { candidates, required: 1 },
      };
    },
  },
);
