import { z } from 'zod';
import { SUBJECT_CATEGORIES } from '../../domain';
import type { AggregateComponentResult, SubjectPoints } from '../types';
import { defineRule, subjectCodesSchema } from './define';

const componentSchema = z
  .object({
    subjectCodes: subjectCodesSchema.optional(),
    category: z.enum(SUBJECT_CATEGORIES).optional(),
    count: z.int().min(1),
  })
  .strict()
  .refine((c) => !(c.subjectCodes && c.category), {
    message: 'Use either subjectCodes or category, not both',
  });

/**
 * An aggregate (sum of grade points) at or below a maximum. The aggregate is
 * built from components taken in order, each counting the student's best
 * `count` grades from its pool; a subject counts in at most one component.
 * Typical WASSCE aggregate: English + Core Maths + best of Integrated
 * Science / Social Studies + best three electives.
 */
export const aggregateMaxRule = defineRule(
  'aggregate_max',
  z
    .object({
      maxAggregate: z.int().min(1),
      components: z.array(componentSchema).min(1),
    })
    .strict(),
  {
    referencedCodes: (p) => ({
      subjects: p.components.flatMap((c) => c.subjectCodes ?? []),
      grades: [],
    }),
    evaluate(p, { catalogue, results }) {
      const used = new Set<string>();
      const components: AggregateComponentResult[] = [];
      let complete = true;

      for (const component of p.components) {
        const pool = component.subjectCodes ?? catalogue.subjectCodes(component.category);
        const available = pool
          .filter((code) => !used.has(code))
          .flatMap((subjectCode): SubjectPoints[] => {
            const gradeCode = results[subjectCode];
            const points = gradeCode ? catalogue.grade(gradeCode)?.points : null;
            return gradeCode && points != null ? [{ subjectCode, gradeCode, points }] : [];
          })
          .sort((a, b) => a.points - b.points || a.subjectCode.localeCompare(b.subjectCode));
        const counted = available.slice(0, component.count);
        for (const s of counted) used.add(s.subjectCode);
        if (counted.length < component.count) complete = false;
        components.push({
          subjectCodes: component.subjectCodes ?? null,
          category: component.category ?? null,
          count: component.count,
          counted,
        });
      }

      const counted = components.flatMap((c) => c.counted);
      const aggregate = complete ? counted.reduce((sum, s) => sum + s.points, 0) : null;
      const satisfied = aggregate !== null && aggregate <= p.maxAggregate;
      return {
        outcome: satisfied ? 'satisfied' : 'unsatisfied',
        reason: satisfied
          ? null
          : aggregate === null
            ? 'not_enough_subjects'
            : 'aggregate_too_high',
        explanation: {
          type: 'aggregate_max',
          maxAggregate: p.maxAggregate,
          aggregate,
          counted,
          components,
        },
      };
    },
  },
);
