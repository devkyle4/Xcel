import type {
  RequirementGroupInput,
  RequirementGroupNode,
  RequirementNode,
  RequirementOperator,
  RequirementRuleInput,
} from '@xcel/shared';

/**
 * The requirement tree while it is being edited. Every node has an id (saved
 * ids, or "new-…" for nodes added here) so edits, problems and previews can
 * point at it. The server assigns fresh ids when the tree is saved.
 */
export type EditorRule = RequirementRuleInput & { id: string };
export type EditorGroup = Omit<RequirementGroupInput, 'children'> & {
  id: string;
  children: EditorNode[];
};
export type EditorNode = EditorRule | EditorGroup;

let counter = 0;
export const newId = () => `new-${++counter}`;

export function fromSaved(node: RequirementGroupNode): EditorGroup;
export function fromSaved(node: RequirementNode): EditorNode;
export function fromSaved(node: RequirementNode): EditorNode {
  if (node.kind === 'rule') {
    return {
      kind: 'rule',
      id: node.id,
      ruleType: node.ruleType,
      params: structuredClone(node.params ?? {}) as Record<string, unknown>,
      label: node.label ?? null,
    };
  }
  return {
    kind: 'group',
    id: node.id,
    operator: node.operator,
    minCount: node.minCount ?? null,
    label: node.label ?? null,
    children: node.children.map((c) => fromSaved(c)),
  };
}

export function newGroup(operator: RequirementOperator = 'all'): EditorGroup {
  return {
    kind: 'group',
    id: newId(),
    operator,
    minCount: operator === 'at_least' ? 1 : null,
    label: null,
    children: [],
  };
}

export function newRule(ruleType: string, params: Record<string, unknown>): EditorRule {
  return { kind: 'rule', id: newId(), ruleType, params, label: null };
}

/** Replaces the node with `id` by `update(node)`; returns a new tree. */
export function updateNode(
  root: EditorGroup,
  id: string,
  update: (node: EditorNode) => EditorNode,
): EditorGroup {
  const visit = (node: EditorNode): EditorNode => {
    if (node.id === id) return update(node);
    if (node.kind === 'rule') return node;
    return { ...node, children: node.children.map(visit) };
  };
  return visit(root) as EditorGroup;
}

/** Removes a node (never the root). */
export function removeNode(root: EditorGroup, id: string): EditorGroup {
  const visit = (group: EditorGroup): EditorGroup => ({
    ...group,
    children: group.children
      .filter((c) => c.id !== id)
      .map((c) => (c.kind === 'group' ? visit(c) : c)),
  });
  return visit(root);
}

/** Moves a node one place up (-1) or down (+1) among its siblings. */
export function moveNode(root: EditorGroup, id: string, direction: -1 | 1): EditorGroup {
  const visit = (group: EditorGroup): EditorGroup => {
    const index = group.children.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index >= 0 && target >= 0 && target < group.children.length) {
      const children = [...group.children];
      [children[index], children[target]] = [children[target]!, children[index]!];
      return { ...group, children };
    }
    return { ...group, children: group.children.map((c) => (c.kind === 'group' ? visit(c) : c)) };
  };
  return visit(root);
}

/** Adds a node as the last child of a group. */
export function addChild(root: EditorGroup, groupId: string, child: EditorNode): EditorGroup {
  return updateNode(root, groupId, (node) =>
    node.kind === 'group' ? { ...node, children: [...node.children, child] } : node,
  );
}

/**
 * Changes a group's operator, keeping its count valid: "any N of" needs a
 * count, the others must not have one.
 */
export function setOperator(group: EditorGroup, operator: RequirementOperator): EditorGroup {
  return {
    ...group,
    operator,
    minCount:
      operator === 'at_least'
        ? Math.min(Math.max(group.minCount ?? 1, 1), Math.max(group.children.length, 1))
        : null,
  };
}
