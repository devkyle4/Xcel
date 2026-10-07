import { describe, expect, it } from 'vitest';
import { EligibilityInputError, evaluateEligibility } from './evaluate';
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
import type { GroupResult, NodeResult, RequirementGroupNode, StudentResults } from './types';

const evaluate = (root: RequirementGroupNode | null, results: StudentResults) =>
  evaluateEligibility(root, results, catalogue);

const ids = (nodes: NodeResult[]) => nodes.map((n) => n.id);

describe('statuses', () => {
  const strong: StudentResults = { ENGLISH: 'B2', CORE_MATHS: 'C4', PHYSICS: 'B3' };

  it('is Eligible when every requirement is met', () => {
    const result = evaluate(all(grade('C6', 'ENGLISH'), grade('C6', 'CORE_MATHS')), strong);
    expect(result.status).toBe('Eligible');
    expect(result.causes).toEqual([]);
  });

  it('is NotEligible when a requirement is not met, naming that requirement', () => {
    const failing = grade('B3', 'CORE_MATHS');
    const result = evaluate(all(grade('C6', 'ENGLISH'), failing), strong);
    expect(result.status).toBe('NotEligible');
    expect(ids(result.causes)).toEqual([failing.id]);
    expect(result.causes[0]).toMatchObject({ reason: 'grade_too_low' });
  });

  it('is LikelyEligible when everything checkable is met but something needs confirming', () => {
    const interview = manual('Pass the entrance interview');
    const result = evaluate(all(grade('C6', 'ENGLISH'), interview), strong);
    expect(result.status).toBe('LikelyEligible');
    expect(ids(result.causes)).toEqual([interview.id]);
  });

  it('is NeedsReview when a requirement cannot be evaluated', () => {
    const unknown = rule('portfolio_score', { min: 70 });
    const result = evaluate(all(grade('C6', 'ENGLISH'), unknown), strong);
    expect(result.status).toBe('NeedsReview');
    expect(ids(result.causes)).toEqual([unknown.id]);
    expect(result.causes[0]).toMatchObject({
      outcome: 'unevaluable',
      explanation: { type: 'invalid', problem: 'unknown_rule_type' },
    });
  });

  it('is NeedsReview when no requirements are configured', () => {
    expect(evaluate(null, strong)).toEqual({ status: 'NeedsReview', root: null, causes: [] });
  });
});

describe('precedence of outcomes', () => {
  const results: StudentResults = { ENGLISH: 'D7' };

  it('a definite failure beats confirmation and unevaluable parts in AND', () => {
    const failing = grade('C6', 'ENGLISH');
    const result = evaluate(all(manual('Interview'), rule('unknown_type', {}), failing), results);
    expect(result.status).toBe('NotEligible');
    expect(ids(result.causes)).toEqual([failing.id]);
  });

  it('unevaluable beats confirmation in AND', () => {
    expect(evaluate(all(manual('Interview'), rule('unknown_type', {})), results).status).toBe(
      'NeedsReview',
    );
  });

  it('a met alternative beats unevaluable and failing alternatives in OR', () => {
    expect(
      evaluate(
        any(rule('unknown_type', {}), grade('C6', 'ENGLISH'), grade('E8', 'ENGLISH')),
        results,
      ).status,
    ).toBe('Eligible');
  });

  it('confirmation beats unevaluable in OR', () => {
    expect(evaluate(any(rule('unknown_type', {}), manual('Interview')), results).status).toBe(
      'LikelyEligible',
    );
  });
});

describe('AND / OR / nested groups', () => {
  const results: StudentResults = {
    ENGLISH: 'C5',
    CORE_MATHS: 'C6',
    INTEGRATED_SCIENCE: 'D7',
    PHYSICS: 'B3',
    CHEMISTRY: 'E8',
    BIOLOGY: 'C4',
  };

  it('AND needs every child', () => {
    expect(evaluate(all(grade('C6', 'ENGLISH'), grade('C6', 'PHYSICS')), results).status).toBe(
      'Eligible',
    );
    expect(
      evaluate(all(grade('C6', 'ENGLISH'), grade('C6', 'INTEGRATED_SCIENCE')), results).status,
    ).toBe('NotEligible');
  });

  it('OR needs one child, and lists every alternative when all fail', () => {
    expect(
      evaluate(all(any(grade('C6', 'CHEMISTRY'), grade('C6', 'BIOLOGY'))), results).status,
    ).toBe('Eligible');

    const chemistry = grade('C6', 'CHEMISTRY');
    const science = grade('C6', 'INTEGRATED_SCIENCE');
    const result = evaluate(all(any(chemistry, science)), results);
    expect(result.status).toBe('NotEligible');
    expect(ids(result.causes)).toEqual([chemistry.id, science.id]);
  });

  it('evaluates nested groups and reports only the failing branch', () => {
    const failing = grade('B2', 'PHYSICS');
    const root = all(
      grade('C6', 'ENGLISH'),
      any(all(grade('C6', 'PHYSICS'), failing), all(grade('C6', 'CHEMISTRY'))),
    );
    const result = evaluate(root, results);
    expect(result.status).toBe('NotEligible');
    // Both OR branches failed: the B2 Physics rule in one, Chemistry in the other.
    expect(result.causes).toHaveLength(2);
    expect(ids(result.causes)).toContain(failing.id);

    const nested = (result.root!.children[1] as GroupResult).children[0] as GroupResult;
    expect(nested).toMatchObject({ outcome: 'unsatisfied', required: 2, satisfiedCount: 1 });
  });

  it('"any N of" needs N children', () => {
    const three = [grade('C6', 'PHYSICS'), grade('C6', 'CHEMISTRY'), grade('C6', 'BIOLOGY')];
    const result = evaluate(atLeast(2, ...three), results);
    expect(result.status).toBe('Eligible');
    expect(result.root).toMatchObject({ required: 2, satisfiedCount: 2 });

    const strict = evaluate(atLeast(3, ...three), results);
    expect(strict.status).toBe('NotEligible');
    expect(ids(strict.causes)).toEqual([three[1]!.id]);
  });

  it('"any N of" counts confirmations as possible', () => {
    expect(evaluate(atLeast(2, grade('C6', 'PHYSICS'), manual('Interview')), results).status).toBe(
      'LikelyEligible',
    );
  });
});

describe('each subject counts once', () => {
  it('does not let one subject satisfy two sibling requirements', () => {
    // "Physics, plus any two elective subjects": Physics cannot be one of the two.
    const physics = grade('C6', 'PHYSICS');
    const twoElectives = rule('subject_count', { count: 2, minGrade: 'C6', category: 'elective' });
    const root = all(physics, twoElectives);

    const short = evaluate(root, { PHYSICS: 'A1', CHEMISTRY: 'B2' });
    expect(short.status).toBe('NotEligible');
    expect(short.causes).toEqual([
      expect.objectContaining({ id: twoElectives.id, reason: 'subjects_already_counted' }),
    ]);

    const enough = evaluate(root, { PHYSICS: 'A1', CHEMISTRY: 'B2', BIOLOGY: 'C6' });
    expect(enough.status).toBe('Eligible');
    expect(enough.root!.children.map((c) => (c.kind === 'rule' ? c.countedSubjects : []))).toEqual([
      ['PHYSICS'],
      ['CHEMISTRY', 'BIOLOGY'],
    ]);
  });

  it('finds an assignment where a greedy one would fail', () => {
    // "Physics or Chemistry" and "Physics": only valid if Chemistry is used for the first.
    const result = evaluate(all(grade('C6', 'PHYSICS', 'CHEMISTRY'), grade('C6', 'PHYSICS')), {
      PHYSICS: 'A1',
      CHEMISTRY: 'C6',
    });
    expect(result.status).toBe('Eligible');
    expect(result.root!.children.map((c) => (c.kind === 'rule' ? c.countedSubjects : []))).toEqual([
      ['CHEMISTRY'],
      ['PHYSICS'],
    ]);
  });

  it('applies to "any N of" groups', () => {
    const result = evaluate(
      atLeast(2, grade('C6', 'PHYSICS', 'CHEMISTRY'), grade('C6', 'PHYSICS', 'CHEMISTRY')),
      { PHYSICS: 'A1' },
    );
    expect(result.status).toBe('NotEligible');
  });

  it('does not apply between alternatives of an OR group', () => {
    expect(
      evaluate(any(grade('C6', 'PHYSICS'), grade('B3', 'PHYSICS')), { PHYSICS: 'A1' }).status,
    ).toBe('Eligible');
  });
});

describe('misconfigured requirements', () => {
  it('never treats an empty group as met', () => {
    const empty = all();
    const result = evaluate(all(grade('C6', 'ENGLISH'), empty), { ENGLISH: 'A1' });
    expect(result.status).toBe('NeedsReview');
    expect(result.causes).toEqual([
      expect.objectContaining({ id: empty.id, problem: 'empty_group' }),
    ]);
  });

  it.each([0, 3, null])('rejects "any N of" with N = %s for two children', (n) => {
    const group: RequirementGroupNode = {
      ...atLeast(1, grade('C6', 'ENGLISH'), grade('C6', 'PHYSICS')),
      minCount: n,
    };
    const result = evaluate(group, { ENGLISH: 'A1', PHYSICS: 'A1' });
    expect(result.status).toBe('NeedsReview');
    expect(result.root).toMatchObject({ problem: 'invalid_min_count' });
  });

  it('cannot evaluate rules with invalid params or unknown codes', () => {
    const badParams = rule('subject_grade', { subjectCodes: 'PHYSICS', minGrade: 'C6' });
    const unknownSubject = grade('C6', 'ASTRONOMY');
    const unknownGrade = grade('Z9', 'PHYSICS');
    const result = evaluate(all(badParams, unknownSubject, unknownGrade), { PHYSICS: 'A1' });
    expect(result.status).toBe('NeedsReview');
    expect(result.causes.map((c) => c.kind === 'rule' && c.explanation)).toEqual([
      expect.objectContaining({ problem: 'invalid_params' }),
      expect.objectContaining({ problem: 'unknown_codes', detail: 'Unknown subject ASTRONOMY' }),
      expect.objectContaining({ problem: 'unknown_codes', detail: 'Unknown grade Z9' }),
    ]);
  });
});

describe('inputs', () => {
  it('rejects results with unknown subjects or grades', () => {
    expect(() => evaluate(all(grade('C6', 'ENGLISH')), { ENGLISH: 'G1' })).toThrow(
      EligibilityInputError,
    );
    expect(() => evaluate(all(grade('C6', 'ENGLISH')), { ASTRONOMY: 'A1' })).toThrow(
      /Unknown subject ASTRONOMY/,
    );
  });

  it('does not modify the requirement tree or results', () => {
    const root = all(
      grade('C6', 'PHYSICS'),
      rule('subject_count', { count: 1, minGrade: 'C6', category: 'elective' }),
    );
    const results = { PHYSICS: 'A1' };
    const snapshot: unknown = JSON.parse(JSON.stringify({ root, results }));
    evaluate(root, results);
    expect({ root, results }).toEqual(snapshot);
  });
});

describe('a realistic engineering programme', () => {
  // Credits in English, Core Maths and Integrated Science; credits in Elective
  // Maths and Physics; a credit in Chemistry or Biology; aggregate 24 or better.
  const programme = () =>
    all(
      grade('C6', 'ENGLISH'),
      grade('C6', 'CORE_MATHS'),
      grade('C6', 'INTEGRATED_SCIENCE'),
      grade('C6', 'ELECTIVE_MATHS'),
      grade('C6', 'PHYSICS'),
      grade('C6', 'CHEMISTRY', 'BIOLOGY'),
      standardAggregate(24),
    );

  const base: StudentResults = {
    ENGLISH: 'B3',
    CORE_MATHS: 'B2',
    INTEGRATED_SCIENCE: 'C4',
    SOCIAL_STUDIES: 'B3',
    ELECTIVE_MATHS: 'B3',
    PHYSICS: 'C4',
    CHEMISTRY: 'C5',
    BIOLOGY: 'D7',
  };

  it('accepts a strong candidate', () => {
    expect(evaluate(programme(), base).status).toBe('Eligible');
  });

  it('rejects a candidate who misses one subject requirement despite a good aggregate', () => {
    const result = evaluate(programme(), { ...base, PHYSICS: 'D7' });
    expect(result.status).toBe('NotEligible');
    expect(result.causes).toHaveLength(1);
    expect(result.causes[0]).toMatchObject({
      explanation: { studentGrades: [{ subjectCode: 'PHYSICS', gradeCode: 'D7' }] },
    });
  });

  it('rejects a candidate whose aggregate is too high', () => {
    const result = evaluate(programme(), {
      ...base,
      ELECTIVE_MATHS: 'C6',
      PHYSICS: 'C6',
      CHEMISTRY: 'C6',
      ENGLISH: 'C6',
      CORE_MATHS: 'C6',
    });
    expect(result.status).toBe('NotEligible');
    expect(result.causes[0]).toMatchObject({ reason: 'aggregate_too_high' });
  });
});
