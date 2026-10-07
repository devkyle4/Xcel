import { getRuleType } from '@xcel/shared';
import type { Executor } from '../db/client';
import { requirementRules } from '../db/schema';

/**
 * How many requirement rules (in any cycle, including archived history) refer
 * to each subject and grade code, using each rule type's own definition of
 * the codes it references.
 */
export async function ruleReferenceCounts(db: Executor) {
  const rules = await db
    .select({ ruleType: requirementRules.ruleType, params: requirementRules.params })
    .from(requirementRules);

  const subjects = new Map<string, number>();
  const grades = new Map<string, number>();
  const add = (map: Map<string, number>, codes: string[]) => {
    for (const code of new Set(codes)) map.set(code, (map.get(code) ?? 0) + 1);
  };
  for (const rule of rules) {
    const prepared = getRuleType(rule.ruleType)?.prepare(rule.params);
    if (!prepared?.success) continue;
    add(subjects, prepared.rule.referencedCodes.subjects);
    add(grades, prepared.rule.referencedCodes.grades);
  }
  return { subjects, grades };
}
