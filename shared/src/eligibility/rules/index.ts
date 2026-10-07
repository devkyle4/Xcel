import { aggregateMaxRule } from './aggregate-max';
import type { RuleType } from './define';
import { manualReviewRule } from './manual-review';
import { subjectCountRule } from './subject-count';
import { subjectGradeRule } from './subject-grade';

export type { RuleType } from './define';

/** All rule types the engine understands, keyed by the `rule_type` stored in the database. */
export const RULE_TYPES: Readonly<Record<string, RuleType>> = Object.fromEntries(
  [subjectGradeRule, subjectCountRule, aggregateMaxRule, manualReviewRule].map((r) => [r.name, r]),
);

export function getRuleType(name: string): RuleType | undefined {
  return Object.hasOwn(RULE_TYPES, name) ? RULE_TYPES[name] : undefined;
}
