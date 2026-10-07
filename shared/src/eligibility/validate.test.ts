import { describe, expect, it } from 'vitest';
import {
  all,
  any,
  atLeast,
  catalogue,
  grade,
  manual,
  rule,
  standardAggregate,
} from './test-fixtures';
import { studentResultsSchema, validateRequirementTree, validateStudentResults } from './validate';

describe('validateRequirementTree', () => {
  it('accepts a well-formed tree', () => {
    const tree = all(grade('C6', 'ENGLISH'), any(grade('C6', 'PHYSICS'), manual('Interview')));
    expect(validateRequirementTree(tree, catalogue)).toEqual([]);
  });

  it('reports a missing tree', () => {
    expect(validateRequirementTree(null, catalogue)).toEqual([
      expect.objectContaining({ code: 'no_requirements' }),
    ]);
  });

  it('reports each problem with the node responsible', () => {
    const empty = all();
    const badCount = atLeast(5, grade('C6', 'PHYSICS'));
    const unknownType = rule('portfolio_score', {});
    const badParams = rule('subject_grade', { minGrade: 'C6' });
    const unknownCode = grade('C6', 'ASTRONOMY');
    const tree = all(grade('C6', 'ENGLISH'), empty, badCount, unknownType, badParams, unknownCode);

    expect(validateRequirementTree(tree, catalogue).map((i) => [i.nodeId, i.code])).toEqual([
      [empty.id, 'empty_group'],
      [badCount.id, 'invalid_min_count'],
      [unknownType.id, 'unknown_rule_type'],
      [badParams.id, 'invalid_params'],
      [unknownCode.id, 'unknown_codes'],
    ]);
  });

  it('reports a count on a group that is not "any N of"', () => {
    const tree = { ...all(grade('C6', 'ENGLISH')), minCount: 1 };
    expect(validateRequirementTree(tree, catalogue)).toEqual([
      expect.objectContaining({ nodeId: tree.id, code: 'unexpected_min_count' }),
    ]);
  });

  it('rejects requirements that depend on aggregate alone', () => {
    expect(validateRequirementTree(all(standardAggregate(24)), catalogue)).toEqual([
      expect.objectContaining({ nodeId: null, code: 'aggregate_only' }),
    ]);
    expect(
      validateRequirementTree(all(standardAggregate(24), grade('C6', 'ENGLISH')), catalogue),
    ).toEqual([]);
  });
});

describe('validateStudentResults', () => {
  it('accepts known subjects and grades', () => {
    expect(validateStudentResults({ ENGLISH: 'A1', PHYSICS: 'F9' }, catalogue)).toEqual([]);
  });

  it('reports unknown subjects and grades', () => {
    expect(
      validateStudentResults({ ASTRONOMY: 'A1', PHYSICS: 'G1' }, catalogue).map((i) => i.code),
    ).toEqual(['unknown_subject', 'unknown_grade']);
  });
});

describe('studentResultsSchema', () => {
  it('accepts a subject-to-grade map', () => {
    expect(studentResultsSchema.safeParse({ ENGLISH: 'A1' }).success).toBe(true);
  });

  it.each([
    [{}],
    [Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`S${i}`, 'A1']))],
    [{ ENGLISH: '' }],
    [{ ENGLISH: 1 }],
    [[['ENGLISH', 'A1']]],
  ])('rejects %j', (input) => {
    expect(studentResultsSchema.safeParse(input).success).toBe(false);
  });
});
