import type { RequirementGroupNode } from '@xcel/shared';
import { describe, expect, it } from 'vitest';
import { buildRequirementTrees } from './requirements';

const group = (id: string, cycleId: string, parentGroupId: string | null, sortOrder = 0) => ({
  id,
  cycleId,
  parentGroupId,
  operator: 'all' as const,
  minCount: null,
  label: null,
  sortOrder,
});
const rule = (id: string, groupId: string, sortOrder = 0) => ({
  id,
  groupId,
  ruleType: 'subject_grade',
  params: { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
  label: null,
  sortOrder,
});

describe('buildRequirementTrees', () => {
  it('builds one tree per cycle from its root group', () => {
    const trees = buildRequirementTrees(
      [group('g1', 'c1', null), group('g2', 'c1', 'g1', 1), group('g3', 'c2', null)],
      [rule('r1', 'g1', 0), rule('r2', 'g2'), rule('r3', 'g3')],
    );
    expect([...trees.keys()].sort()).toEqual(['c1', 'c2']);
    const c1 = trees.get('c1')!;
    expect(c1.children.map((n) => n.id)).toEqual(['r1', 'g2']);
    expect((c1.children[1] as RequirementGroupNode).children.map((n) => n.id)).toEqual(['r2']);
  });

  it('orders groups and rules together by sortOrder', () => {
    const tree = buildRequirementTrees(
      [group('g1', 'c1', null), group('g2', 'c1', 'g1', 0)],
      [rule('r1', 'g1', 2), rule('r2', 'g1', 1)],
    ).get('c1')!;
    expect(tree.children.map((n) => n.id)).toEqual(['g2', 'r2', 'r1']);
  });

  it('ignores groups that are not connected to a root', () => {
    // A loop with no root cannot be reached and must not cause infinite recursion.
    const trees = buildRequirementTrees(
      [group('g1', 'c1', null), group('a', 'c1', 'b'), group('b', 'c1', 'a')],
      [],
    );
    expect(trees.get('c1')!.children).toEqual([]);
  });
});
