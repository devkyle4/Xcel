import type { RequirementGroupNode } from '@xcel/shared';
import {
  addChild,
  type EditorGroup,
  type EditorRule,
  fromSaved,
  moveNode,
  newGroup,
  newRule,
  removeNode,
  setOperator,
  updateNode,
} from './tree';

const saved: RequirementGroupNode = {
  kind: 'group',
  id: 'root',
  operator: 'all',
  children: [
    {
      kind: 'rule',
      id: 'a',
      ruleType: 'subject_grade',
      params: { subjectCodes: ['ENGLISH'], minGrade: 'C6' },
    },
    {
      kind: 'group',
      id: 'g',
      operator: 'any',
      children: [
        { kind: 'rule', id: 'b', ruleType: 'manual_review', params: { description: 'Interview' } },
      ],
    },
  ],
};

const ids = (g: EditorGroup) => g.children.map((c) => c.id);

describe('requirement tree editing', () => {
  it('loads a saved tree without sharing objects with it', () => {
    const tree = fromSaved(saved);
    expect(ids(tree)).toEqual(['a', 'g']);
    const edited = updateNode(tree, 'a', (n) => ({ ...n, label: 'English' }));
    expect(edited.children[0]).toMatchObject({ label: 'English' });
    expect(tree.children[0]).toMatchObject({ label: null });
    (tree.children[0] as EditorRule).params.minGrade = 'B3';
    expect((saved.children[0] as { params: { minGrade: string } }).params.minGrade).toBe('C6');
  });

  it('adds, moves and removes nodes at any depth', () => {
    let tree = fromSaved(saved);
    const rule = newRule('manual_review', { description: 'Medical' });
    tree = addChild(tree, 'g', rule);
    expect(ids(tree.children[1] as EditorGroup)).toEqual(['b', rule.id]);
    tree = moveNode(tree, rule.id, -1);
    expect(ids(tree.children[1] as EditorGroup)).toEqual([rule.id, 'b']);
    tree = moveNode(tree, rule.id, -1); // already first: unchanged
    expect(ids(tree.children[1] as EditorGroup)).toEqual([rule.id, 'b']);
    tree = moveNode(tree, 'a', 1);
    expect(ids(tree)).toEqual(['g', 'a']);
    tree = removeNode(tree, 'b');
    expect(ids(tree.children[0] as EditorGroup)).toEqual([rule.id]);
  });

  it('gives new nodes unique ids', () => {
    expect(newGroup().id).not.toBe(newGroup().id);
  });

  it('keeps the "any N of" count valid when the operator changes', () => {
    const group = { ...fromSaved(saved), minCount: null };
    expect(setOperator(group, 'at_least').minCount).toBe(1);
    expect(setOperator({ ...group, operator: 'at_least', minCount: 5 }, 'at_least').minCount).toBe(
      2,
    );
    expect(setOperator({ ...group, operator: 'at_least', minCount: 2 }, 'any').minCount).toBeNull();
  });
});
