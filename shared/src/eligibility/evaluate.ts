import { largestCompatibleSubset } from './allocation';
import { indexCatalogue } from './catalogue';
import { prepareRule } from './prepare';
import type { RuleContext, SubjectAllocation } from './rules/define';
import type {
  AcademicCatalogue,
  EligibilityResult,
  EligibilityStatus,
  GroupResult,
  NodeOutcome,
  NodeResult,
  RequirementGroupNode,
  RequirementNode,
  RequirementRuleNode,
  RuleResult,
  StudentResults,
} from './types';
import { validateStudentResults } from './validate';

export class EligibilityInputError extends Error {
  constructor(public readonly issues: ReturnType<typeof validateStudentResults>) {
    super(`Invalid student results: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'EligibilityInputError';
  }
}

const STATUS_BY_OUTCOME: Record<NodeOutcome, EligibilityStatus> = {
  satisfied: 'Eligible',
  needs_confirmation: 'LikelyEligible',
  unsatisfied: 'NotEligible',
  unevaluable: 'NeedsReview',
};

/**
 * Evaluates a student's results against one admission cycle's requirement tree.
 * Pure: no I/O, and the inputs are not modified.
 *
 * Within an `all` or `at_least` group, each subject counts towards at most one
 * of the group's direct subject rules. Separate nested groups are evaluated
 * independently.
 *
 * @throws EligibilityInputError if the results use unknown subject or grade codes.
 */
export function evaluateEligibility(
  root: RequirementGroupNode | null,
  results: StudentResults,
  catalogue: AcademicCatalogue,
): EligibilityResult {
  const index = indexCatalogue(catalogue);
  const issues = validateStudentResults(results, catalogue);
  if (issues.length > 0) throw new EligibilityInputError(issues);

  if (!root) return { status: 'NeedsReview', root: null, causes: [] };

  const rootResult = evaluateGroup(root, { catalogue: index, results });
  const status = STATUS_BY_OUTCOME[rootResult.outcome];
  return {
    status,
    root: rootResult,
    causes: status === 'Eligible' ? [] : collectCauses(rootResult, rootResult.outcome),
  };
}

interface Evaluated {
  result: NodeResult;
  allocation?: SubjectAllocation;
}

function evaluateNode(node: RequirementNode, context: RuleContext): Evaluated {
  return node.kind === 'rule'
    ? evaluateRule(node, context)
    : { result: evaluateGroup(node, context) };
}

function evaluateRule(node: RequirementRuleNode, context: RuleContext): Evaluated {
  const base = {
    kind: 'rule' as const,
    id: node.id,
    ruleType: node.ruleType,
    label: node.label ?? null,
  };
  const prepared = prepareRule(node, context.catalogue);
  if (!prepared.ok) {
    return {
      result: {
        ...base,
        outcome: 'unevaluable',
        reason: null,
        explanation: { type: 'invalid', problem: prepared.problem, detail: prepared.detail },
        countedSubjects: [],
      },
    };
  }

  const evaluation = prepared.rule.evaluate(context);
  const { allocation } = evaluation;
  const result: RuleResult = {
    ...base,
    outcome: evaluation.outcome,
    reason: evaluation.reason,
    explanation: evaluation.explanation,
    countedSubjects:
      allocation && evaluation.outcome === 'satisfied'
        ? allocation.candidates.slice(0, allocation.required)
        : [],
  };
  return allocation ? { result, allocation } : { result };
}

function requiredCount(node: RequirementGroupNode): number | null {
  switch (node.operator) {
    case 'all':
      return node.children.length;
    case 'any':
      return 1;
    case 'at_least':
      return Number.isInteger(node.minCount) && node.minCount! >= 1 ? node.minCount! : null;
  }
}

function evaluateGroup(node: RequirementGroupNode, context: RuleContext): GroupResult {
  const evaluated = node.children.map((child) => evaluateNode(child, context));
  const base = {
    kind: 'group' as const,
    id: node.id,
    operator: node.operator,
    minCount: node.minCount ?? null,
    label: node.label ?? null,
  };
  const misconfigured = (problem: GroupResult['problem'], required: number): GroupResult => ({
    ...base,
    outcome: 'unevaluable',
    required,
    satisfiedCount: 0,
    problem,
    children: evaluated.map((e) => e.result),
  });

  // An empty group must never count as met: that would make everyone eligible.
  if (evaluated.length === 0) return misconfigured('empty_group', 0);

  const required = requiredCount(node);
  if (required === null || required > evaluated.length) {
    return misconfigured('invalid_min_count', required ?? 0);
  }

  // In an OR group one child is enough, so subjects need not be shared out.
  if (node.operator !== 'any' && !shareSubjects(evaluated)) {
    return misconfigured('too_complex', required);
  }

  const children = evaluated.map((e) => e.result);
  const count = (outcome: NodeOutcome) => children.filter((c) => c.outcome === outcome).length;
  const satisfied = count('satisfied');
  const confirm = count('needs_confirmation');
  const unevaluable = count('unevaluable');

  // A definite failure outweighs uncertainty; uncertainty outweighs success.
  let outcome: NodeOutcome;
  if (satisfied >= required) outcome = 'satisfied';
  else if (satisfied + confirm >= required) outcome = 'needs_confirmation';
  else if (satisfied + confirm + unevaluable >= required) outcome = 'unevaluable';
  else outcome = 'unsatisfied';

  return { ...base, outcome, required, satisfiedCount: satisfied, problem: null, children };
}

/**
 * Ensures sibling rules that count subjects do not count the same subject
 * twice. Rules that cannot get their own subjects become unsatisfied.
 * Returns false if there are too many such rules to check.
 */
function shareSubjects(evaluated: Evaluated[]): boolean {
  const consumers = evaluated.flatMap((e, i) =>
    e.allocation && e.result.outcome === 'satisfied' ? [{ i, allocation: e.allocation }] : [],
  );
  if (consumers.length < 2) return true;

  const subset = largestCompatibleSubset(consumers.map((c) => c.allocation));
  if (!subset) return false;

  consumers.forEach(({ i }, position) => {
    const rule = evaluated[i]!.result as RuleResult;
    const chosen = subset.indices.indexOf(position);
    evaluated[i]!.result =
      chosen >= 0
        ? { ...rule, countedSubjects: subset.counted[chosen]! }
        : {
            ...rule,
            outcome: 'unsatisfied',
            reason: 'subjects_already_counted',
            countedSubjects: [],
          };
  });
  return true;
}

/** The nodes responsible for a group reaching `outcome`. */
function collectCauses(node: NodeResult, outcome: NodeOutcome): NodeResult[] {
  if (node.outcome !== outcome) return [];
  if (node.kind === 'rule' || node.problem) return [node];
  return node.children.flatMap((child) => collectCauses(child, outcome));
}
