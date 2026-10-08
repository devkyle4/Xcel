import {
  type AcademicCatalogue,
  describeGroup,
  describeRequirement,
  evaluateEligibility,
  indexCatalogue,
  type NodeResult,
  type RequirementGroupNode,
} from '@xcel/shared';
import { ruleTypeLabel } from './rule-types';

/**
 * The requirements as indented lines of plain language, e.g.
 * "All of the following" / "  English Language: C6 or better".
 */
export function requirementLines(
  root: RequirementGroupNode | null,
  catalogue: AcademicCatalogue,
): string[] {
  if (!root) return [];
  const index = indexCatalogue(catalogue);
  const lines: string[] = [];
  const visit = (node: NodeResult, depth: number) => {
    const indent = '  '.repeat(depth);
    if (node.kind === 'rule') {
      lines.push(
        indent +
          (node.explanation.type === 'invalid'
            ? `Incomplete requirement (${ruleTypeLabel(node.ruleType)})`
            : describeRequirement(node, index)),
      );
      return;
    }
    lines.push(indent + (node.label ? `${node.label}: ` : '') + describeGroup(node));
    node.children.forEach((c) => visit(c, depth + 1));
  };
  const result = evaluateEligibility(root, {}, catalogue).root;
  if (result) visit(result, 0);
  return lines;
}

export interface LineChange {
  kind: 'added' | 'removed';
  line: string;
}

/** Lines added and removed between two versions (compared as lists, ignoring order of identical lines). */
export function diffLines(before: string[], after: string[]): LineChange[] {
  const remaining = new Map<string, number>();
  for (const line of before) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  const added: LineChange[] = [];
  for (const line of after) {
    const n = remaining.get(line) ?? 0;
    if (n > 0) remaining.set(line, n - 1);
    else added.push({ kind: 'added', line });
  }
  const removed: LineChange[] = [];
  for (const line of before) {
    const n = remaining.get(line) ?? 0;
    if (n > 0) {
      removed.push({ kind: 'removed', line });
      remaining.set(line, n - 1);
    }
  }
  return [...removed, ...added];
}
