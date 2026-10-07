import type { CatalogueIndex } from './catalogue';
import type { PreparedRule } from './rules/define';
import { getRuleType } from './rules';
import type { RequirementRuleNode } from './types';

export type PrepareResult =
  | { ok: true; rule: PreparedRule }
  | {
      ok: false;
      problem: 'unknown_rule_type' | 'invalid_params' | 'unknown_codes';
      detail: string;
    };

/** Resolves a stored rule to its type, validates its params and the codes it references. */
export function prepareRule(node: RequirementRuleNode, catalogue: CatalogueIndex): PrepareResult {
  const type = getRuleType(node.ruleType);
  if (!type) {
    return {
      ok: false,
      problem: 'unknown_rule_type',
      detail: `Unknown rule type "${node.ruleType}"`,
    };
  }

  const prepared = type.prepare(node.params);
  if (!prepared.success) return { ok: false, problem: 'invalid_params', detail: prepared.error };

  const { subjects, grades } = prepared.rule.referencedCodes;
  const unknown = [
    ...subjects.filter((code) => !catalogue.subject(code)).map((code) => `subject ${code}`),
    ...grades.filter((code) => !catalogue.grade(code)).map((code) => `grade ${code}`),
  ];
  if (unknown.length > 0) {
    return { ok: false, problem: 'unknown_codes', detail: `Unknown ${unknown.join(', ')}` };
  }

  return { ok: true, rule: prepared.rule };
}
