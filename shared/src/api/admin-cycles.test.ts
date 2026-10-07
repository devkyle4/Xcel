import { describe, expect, it } from 'vitest';
import { cycleCreateSchema, MAX_REQUIREMENT_DEPTH, requirementsInputSchema } from './admin-cycles';

const rule = {
  kind: 'rule',
  ruleType: 'subject_grade',
  params: { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
};
const group = (children: unknown[], operator = 'all', minCount?: number) => ({
  kind: 'group',
  operator,
  ...(minCount !== undefined && { minCount }),
  children,
});

describe('cycleCreateSchema', () => {
  it('requires the opening date not to follow the deadline', () => {
    expect(
      cycleCreateSchema.safeParse({
        academicYear: '2026/2027',
        applicationOpensOn: '2026-12-01',
        applicationDeadline: '2026-11-01',
      }).success,
    ).toBe(false);
  });
});

describe('requirementsInputSchema', () => {
  it('accepts nested groups and ignores node ids', () => {
    const tree = group([{ ...rule, id: 'old-id' }, group([rule, rule], 'at_least', 1)]);
    expect(requirementsInputSchema.safeParse({ requirements: tree }).success).toBe(true);
    expect(requirementsInputSchema.safeParse({ requirements: null }).success).toBe(true);
  });

  it.each([
    ['"any N of" without a count', group([rule], 'at_least')],
    ['a count on an AND group', group([rule], 'all', 1)],
    ['an invalid rule type name', group([{ ...rule, ruleType: 'Subject Grade' }])],
    ['params that are not an object', group([{ ...rule, params: ['PHYSICS'] }])],
    ['unknown properties', group([{ ...rule, weight: 2 }])],
  ])('rejects %s', (_, tree) => {
    expect(requirementsInputSchema.safeParse({ requirements: tree }).success).toBe(false);
  });

  it('limits nesting depth', () => {
    let tree: unknown = group([rule]);
    for (let i = 1; i < MAX_REQUIREMENT_DEPTH; i++) tree = group([tree]);
    expect(requirementsInputSchema.safeParse({ requirements: tree }).success).toBe(true);
    expect(requirementsInputSchema.safeParse({ requirements: group([tree]) }).success).toBe(false);
  });

  it('limits the number of nodes', () => {
    const wide = group(
      Array.from({ length: 7 }, () => group(Array.from({ length: 49 }, () => rule))),
    );
    expect(requirementsInputSchema.safeParse({ requirements: wide }).success).toBe(false);
  });
});
