import { z } from 'zod';
import type { CatalogueIndex } from '../catalogue';
import type {
  NodeOutcome,
  RuleExplanation,
  RuleFailureReason,
  StudentResults,
  SubjectGrade,
} from '../types';

export interface RuleContext {
  catalogue: CatalogueIndex;
  results: StudentResults;
}

/**
 * Subjects a rule wants to count, for sharing subjects out between sibling
 * rules: the rule needs `required` distinct subjects from `candidates`.
 */
export interface SubjectAllocation {
  /** Best grade first. */
  candidates: string[];
  required: number;
}

export interface RuleEvaluation {
  outcome: NodeOutcome;
  reason: RuleFailureReason | null;
  explanation: RuleExplanation;
  /** Present for rules that count subjects (each subject counts towards one rule). */
  allocation?: SubjectAllocation;
}

export interface ReferencedCodes {
  subjects: string[];
  grades: string[];
}

export interface PreparedRule {
  referencedCodes: ReferencedCodes;
  evaluate(context: RuleContext): RuleEvaluation;
}

export interface RuleType {
  name: string;
  /** Validates the stored params. Exposed so the admin rule builder can reuse it. */
  paramsSchema: z.ZodType;
  prepare(
    params: unknown,
  ): { success: true; rule: PreparedRule } | { success: false; error: string };
}

/** Declares a rule type. New types need only a new definition here, never a data migration. */
export function defineRule<P>(
  name: string,
  paramsSchema: z.ZodType<P>,
  impl: {
    referencedCodes(params: P): ReferencedCodes;
    evaluate(params: P, context: RuleContext): RuleEvaluation;
  },
): RuleType {
  return {
    name,
    paramsSchema,
    prepare(params) {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) return { success: false, error: z.prettifyError(parsed.error) };
      const data = parsed.data;
      return {
        success: true,
        rule: {
          referencedCodes: impl.referencedCodes(data),
          evaluate: (context) => impl.evaluate(data, context),
        },
      };
    },
  };
}

export const codeSchema = z.string().min(1);
export const subjectCodesSchema = z.array(codeSchema).min(1);

/** The student's subjects from `pool` at or above `minGrade`, best grade first. */
export function qualifyingSubjects(
  pool: readonly string[],
  minGrade: string,
  { catalogue, results }: RuleContext,
): SubjectGrade[] {
  return pool
    .flatMap((subjectCode) => {
      const gradeCode = results[subjectCode];
      return gradeCode && catalogue.meetsMinimum(gradeCode, minGrade)
        ? [{ subjectCode, gradeCode }]
        : [];
    })
    .sort(
      (a, b) =>
        (catalogue.grade(a.gradeCode)?.rank ?? 0) - (catalogue.grade(b.gradeCode)?.rank ?? 0),
    );
}
