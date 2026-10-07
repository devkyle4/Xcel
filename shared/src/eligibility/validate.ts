import { z } from 'zod';
import { indexCatalogue } from './catalogue';
import { prepareRule } from './prepare';
import type {
  AcademicCatalogue,
  RequirementGroupNode,
  RequirementNode,
  StudentResults,
} from './types';

export const MAX_RESULT_SUBJECTS = 15;

/** Shape of results sent by the browser: subject code -> grade code. */
export const studentResultsSchema = z
  .record(z.string().min(1).max(64), z.string().min(1).max(16))
  .refine((r) => Object.keys(r).length >= 1, { message: 'Enter at least one subject' })
  .refine((r) => Object.keys(r).length <= MAX_RESULT_SUBJECTS, {
    message: `Enter at most ${MAX_RESULT_SUBJECTS} subjects`,
  });

export interface ResultIssue {
  subjectCode: string;
  code: 'unknown_subject' | 'unknown_grade';
  message: string;
}

/** Checks that every subject and grade in the results exists in the catalogue. */
export function validateStudentResults(
  results: StudentResults,
  catalogue: AcademicCatalogue,
): ResultIssue[] {
  const index = indexCatalogue(catalogue);
  return Object.entries(results).flatMap(([subjectCode, gradeCode]): ResultIssue[] => {
    if (!index.subject(subjectCode)) {
      return [{ subjectCode, code: 'unknown_subject', message: `Unknown subject ${subjectCode}` }];
    }
    if (!index.grade(gradeCode)) {
      return [{ subjectCode, code: 'unknown_grade', message: `Unknown grade ${gradeCode}` }];
    }
    return [];
  });
}

export interface TreeIssue {
  /** The offending node, or null for problems with the tree as a whole. */
  nodeId: string | null;
  code:
    | 'no_requirements'
    | 'empty_group'
    | 'invalid_min_count'
    | 'unexpected_min_count'
    | 'unknown_rule_type'
    | 'invalid_params'
    | 'unknown_codes'
    | 'aggregate_only';
  message: string;
}

const SUBJECT_RULE_TYPES = new Set(['subject_grade', 'subject_count']);

/**
 * Checks a requirement tree before it is saved or published. Anything reported
 * here would make the engine return NeedsReview (or, for aggregate_only,
 * break the rule that eligibility never depends on aggregate alone).
 */
export function validateRequirementTree(
  root: RequirementGroupNode | null,
  catalogue: AcademicCatalogue,
): TreeIssue[] {
  if (!root) {
    return [{ nodeId: null, code: 'no_requirements', message: 'No requirements are configured' }];
  }

  const index = indexCatalogue(catalogue);
  const issues: TreeIssue[] = [];
  const ruleTypes = new Set<string>();

  const visit = (node: RequirementNode) => {
    if (node.kind === 'rule') {
      ruleTypes.add(node.ruleType);
      const prepared = prepareRule(node, index);
      if (!prepared.ok) {
        issues.push({ nodeId: node.id, code: prepared.problem, message: prepared.detail });
      }
      return;
    }

    if (node.children.length === 0) {
      issues.push({ nodeId: node.id, code: 'empty_group', message: 'Group has no requirements' });
    }
    if (node.operator === 'at_least') {
      const n = node.minCount;
      if (!Number.isInteger(n) || n! < 1 || n! > node.children.length) {
        issues.push({
          nodeId: node.id,
          code: 'invalid_min_count',
          message: `"Any N of" needs N between 1 and ${node.children.length}`,
        });
      }
    } else if (node.minCount != null) {
      issues.push({
        nodeId: node.id,
        code: 'unexpected_min_count',
        message: 'Only "any N of" groups take a count',
      });
    }
    node.children.forEach(visit);
  };
  visit(root);

  if (ruleTypes.has('aggregate_max') && ![...ruleTypes].some((t) => SUBJECT_RULE_TYPES.has(t))) {
    issues.push({
      nodeId: null,
      code: 'aggregate_only',
      message: 'Eligibility must not depend on aggregate alone; add subject requirements',
    });
  }
  return issues;
}
