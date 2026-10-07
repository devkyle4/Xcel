import type { RequirementGroupNode, RequirementNode } from '@xcel/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Executor } from '../db/client';
import { requirementGroups, requirementRules } from '../db/schema';

type GroupRow = Pick<
  typeof requirementGroups.$inferSelect,
  'id' | 'cycleId' | 'parentGroupId' | 'operator' | 'minCount' | 'label' | 'sortOrder'
>;
type RuleRow = Pick<
  typeof requirementRules.$inferSelect,
  'id' | 'groupId' | 'ruleType' | 'params' | 'label' | 'sortOrder'
>;

/**
 * Assembles stored groups and rules into one requirement tree per cycle,
 * starting from each cycle's root group. Children (groups and rules together)
 * are ordered by sortOrder.
 */
export function buildRequirementTrees(
  groups: readonly GroupRow[],
  rules: readonly RuleRow[],
): Map<string, RequirementGroupNode> {
  const childGroups = new Map<string, GroupRow[]>();
  const roots: GroupRow[] = [];
  for (const group of groups) {
    if (group.parentGroupId === null) roots.push(group);
    else
      childGroups.set(group.parentGroupId, [
        ...(childGroups.get(group.parentGroupId) ?? []),
        group,
      ]);
  }
  const groupRules = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    groupRules.set(rule.groupId, [...(groupRules.get(rule.groupId) ?? []), rule]);
  }

  const build = (group: GroupRow): RequirementGroupNode => {
    const children: { sortOrder: number; id: string; node: RequirementNode }[] = [
      ...(childGroups.get(group.id) ?? []).map((g) => ({
        sortOrder: g.sortOrder,
        id: g.id,
        node: build(g),
      })),
      ...(groupRules.get(group.id) ?? []).map((r) => ({
        sortOrder: r.sortOrder,
        id: r.id,
        node: {
          kind: 'rule' as const,
          id: r.id,
          ruleType: r.ruleType,
          params: r.params,
          label: r.label,
        },
      })),
    ];
    children.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return {
      kind: 'group',
      id: group.id,
      operator: group.operator,
      minCount: group.minCount,
      label: group.label,
      children: children.map((c) => c.node),
    };
  };

  return new Map(roots.map((root) => [root.cycleId, build(root)]));
}

/** Loads the requirement tree of each given admission cycle. */
export async function loadRequirementTrees(
  db: Executor,
  cycleIds: string[],
): Promise<Map<string, RequirementGroupNode>> {
  if (cycleIds.length === 0) return new Map();

  const groups = await db
    .select({
      id: requirementGroups.id,
      cycleId: requirementGroups.cycleId,
      parentGroupId: requirementGroups.parentGroupId,
      operator: requirementGroups.operator,
      minCount: requirementGroups.minCount,
      label: requirementGroups.label,
      sortOrder: requirementGroups.sortOrder,
    })
    .from(requirementGroups)
    .where(inArray(requirementGroups.cycleId, cycleIds));

  const rules =
    groups.length === 0
      ? []
      : await db
          .select({
            id: requirementRules.id,
            groupId: requirementRules.groupId,
            ruleType: requirementRules.ruleType,
            params: requirementRules.params,
            label: requirementRules.label,
            sortOrder: requirementRules.sortOrder,
          })
          .from(requirementRules)
          .where(
            inArray(
              requirementRules.groupId,
              groups.map((g) => g.id),
            ),
          )
          .orderBy(asc(requirementRules.sortOrder));

  return buildRequirementTrees(groups, rules);
}

type TreeInput = {
  kind: 'group';
  operator: RequirementGroupNode['operator'];
  minCount?: number | null;
  label?: string | null;
  children: readonly (
    TreeInput | { kind: 'rule'; ruleType: string; params: unknown; label?: string | null }
  )[];
};

/**
 * Replaces a cycle's whole requirement tree (null removes it). Node ids are
 * generated here, so the tree is inserted with two statements whatever its
 * size. Must run inside the transaction that audits the change.
 */
export async function replaceRequirementTree(
  tx: Executor,
  cycleId: string,
  root: TreeInput | null,
) {
  await tx.delete(requirementGroups).where(eq(requirementGroups.cycleId, cycleId));
  if (!root) return;

  const groupRows: (typeof requirementGroups.$inferInsert)[] = [];
  const ruleRows: (typeof requirementRules.$inferInsert)[] = [];

  const visit = (group: TreeInput, parentGroupId: string | null, sortOrder: number) => {
    const id = randomUUID();
    groupRows.push({
      id,
      cycleId,
      parentGroupId,
      operator: group.operator,
      minCount: group.minCount ?? null,
      label: group.label ?? null,
      sortOrder,
    });
    group.children.forEach((child, i) => {
      if (child.kind === 'group') visit(child, id, i);
      else {
        ruleRows.push({
          groupId: id,
          ruleType: child.ruleType,
          params: child.params as Record<string, unknown>,
          label: child.label ?? null,
          sortOrder: i,
        });
      }
    });
  };
  visit(root, null, 0);

  await tx.insert(requirementGroups).values(groupRows);
  if (ruleRows.length > 0) await tx.insert(requirementRules).values(ruleRows);
}
