import type { TreeIssue } from '@xcel/shared';
import type { EditorRule } from './tree';

/** Rule types the builder can add, with starting settings for each. */
export const RULE_TYPE_OPTIONS = [
  {
    type: 'subject_grade',
    label: 'Grade in a subject',
    hint: 'e.g. C6 or better in Chemistry or Biology',
    params: { subjectCodes: [] },
  },
  {
    type: 'subject_count',
    label: 'Number of subjects at a grade',
    hint: 'e.g. any three elective subjects at C6 or better',
    params: { count: 1 },
  },
  {
    type: 'aggregate_max',
    label: 'Maximum aggregate',
    hint: 'e.g. an aggregate of 24 or better',
    params: { components: [{ count: 1, subjectCodes: [] }] },
  },
  {
    type: 'manual_review',
    label: 'Confirmed by a person',
    hint: 'e.g. an interview or entrance exam',
    params: { description: '' },
  },
] as const;

export const ruleTypeLabel = (type: string) =>
  RULE_TYPE_OPTIONS.find((o) => o.type === type)?.label ?? `Unsupported rule (${type})`;

const has = (v: unknown) => v !== undefined && v !== null && v !== '';
const isEmptyList = (v: unknown) => !Array.isArray(v) || v.length === 0;
const badCount = (v: unknown) => typeof v !== 'number' || !Number.isInteger(v) || v < 1;

/**
 * Plain messages for incomplete rule settings. The engine's own check still
 * runs; its message is used for anything not covered here.
 */
export function friendlyProblems(rule: EditorRule, issue: TreeIssue): string[] {
  if (issue.code !== 'invalid_params') return [issue.message];
  const p = rule.params;
  const problems: string[] = [];
  const pool = (c: Record<string, unknown>, where = '') => {
    if (c.subjectCodes !== undefined && isEmptyList(c.subjectCodes)) {
      problems.push(`Choose at least one subject${where}.`);
    }
  };
  switch (rule.ruleType) {
    case 'subject_grade':
      if (isEmptyList(p.subjectCodes)) problems.push('Choose at least one subject.');
      if (!has(p.minGrade)) problems.push('Choose a minimum grade.');
      break;
    case 'subject_count':
      if (badCount(p.count)) problems.push('Enter how many subjects, a whole number of 1 or more.');
      if (!has(p.minGrade)) problems.push('Choose a minimum grade.');
      pool(p);
      break;
    case 'aggregate_max': {
      if (badCount(p.maxAggregate)) problems.push('Enter the maximum aggregate, a whole number.');
      const components = Array.isArray(p.components)
        ? (p.components as Record<string, unknown>[])
        : [];
      if (components.length === 0) problems.push('Add at least one part to count.');
      components.forEach((c, i) => {
        if (badCount(c.count)) problems.push(`Part ${i + 1}: enter how many grades to count.`);
        pool(c, ` for part ${i + 1}`);
      });
      break;
    }
    case 'manual_review':
      if (!has(String(p.description ?? '').trim())) {
        problems.push('Describe what must be confirmed.');
      }
      break;
  }
  return problems.length > 0 ? problems : [issue.message];
}
