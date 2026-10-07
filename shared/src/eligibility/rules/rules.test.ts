import { describe, expect, it } from 'vitest';
import { indexCatalogue } from '../catalogue';
import { catalogue } from '../test-fixtures';
import type { StudentResults } from '../types';
import { getRuleType, RULE_TYPES } from '.';

const index = indexCatalogue(catalogue);

function run(ruleType: string, params: unknown, results: StudentResults) {
  const prepared = getRuleType(ruleType)!.prepare(params);
  if (!prepared.success) throw new Error(prepared.error);
  return prepared.rule.evaluate({ catalogue: index, results });
}

describe('rule registry', () => {
  it('registers the built-in rule types', () => {
    expect(Object.keys(RULE_TYPES).sort()).toEqual([
      'aggregate_max',
      'manual_review',
      'subject_count',
      'subject_grade',
    ]);
  });

  it('does not resolve inherited object properties as rule types', () => {
    expect(getRuleType('toString')).toBeUndefined();
    expect(getRuleType('__proto__')).toBeUndefined();
  });
});

describe('subject_grade', () => {
  it('is satisfied at exactly the minimum grade', () => {
    const r = run(
      'subject_grade',
      { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
      { PHYSICS: 'C6' },
    );
    expect(r.outcome).toBe('satisfied');
    expect(r.allocation).toEqual({ candidates: ['PHYSICS'], required: 1 });
  });

  it('reports the grade too low, with the student grade and threshold', () => {
    const r = run(
      'subject_grade',
      { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
      { PHYSICS: 'D7' },
    );
    expect(r).toMatchObject({
      outcome: 'unsatisfied',
      reason: 'grade_too_low',
      explanation: {
        minGrade: 'C6',
        studentGrades: [{ subjectCode: 'PHYSICS', gradeCode: 'D7' }],
      },
    });
  });

  it('reports a subject that was not taken', () => {
    const r = run(
      'subject_grade',
      { subjectCodes: ['PHYSICS'], minGrade: 'C6' },
      { BIOLOGY: 'A1' },
    );
    expect(r).toMatchObject({ outcome: 'unsatisfied', reason: 'not_taken' });
  });

  it('accepts any one of several alternative subjects, best grade first', () => {
    const r = run(
      'subject_grade',
      { subjectCodes: ['CHEMISTRY', 'BIOLOGY'], minGrade: 'C6' },
      { CHEMISTRY: 'C5', BIOLOGY: 'B2' },
    );
    expect(r.outcome).toBe('satisfied');
    expect(r.allocation?.candidates).toEqual(['BIOLOGY', 'CHEMISTRY']);
  });

  it.each([
    [{ subjectCodes: [], minGrade: 'C6' }],
    [{ subjectCodes: ['PHYSICS'] }],
    [{ subjectCodes: ['PHYSICS'], minGrade: 'C6', extra: true }],
    ['PHYSICS'],
  ])('rejects invalid params %j', (params) => {
    expect(getRuleType('subject_grade')!.prepare(params).success).toBe(false);
  });
});

describe('subject_count', () => {
  const results = { PHYSICS: 'B3', CHEMISTRY: 'C6', BIOLOGY: 'D7', ECONOMICS: 'A1', ENGLISH: 'A1' };

  it('counts distinct subjects from a list at the minimum grade', () => {
    const r = run(
      'subject_count',
      { count: 2, minGrade: 'C6', subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'] },
      results,
    );
    expect(r.outcome).toBe('satisfied');
    expect(r.allocation).toEqual({ candidates: ['PHYSICS', 'CHEMISTRY'], required: 2 });
  });

  it('draws from a category and honours exclusions', () => {
    const r = run(
      'subject_count',
      { count: 3, minGrade: 'C6', category: 'elective', excludeSubjectCodes: ['ECONOMICS'] },
      results,
    );
    expect(r).toMatchObject({ outcome: 'unsatisfied', reason: 'not_enough_subjects' });
    expect(r.allocation?.candidates).toEqual(['PHYSICS', 'CHEMISTRY']);
  });

  it('never counts core subjects for an elective pool', () => {
    const r = run('subject_count', { count: 4, minGrade: 'C6', category: 'elective' }, results);
    expect(r.allocation?.candidates).not.toContain('ENGLISH');
  });

  it('rejects both a list and a category', () => {
    const prepared = getRuleType('subject_count')!.prepare({
      count: 1,
      minGrade: 'C6',
      subjectCodes: ['PHYSICS'],
      category: 'elective',
    });
    expect(prepared.success).toBe(false);
  });

  it.each([0, 1.5, -1])('rejects count %s', (count) => {
    expect(getRuleType('subject_count')!.prepare({ count, minGrade: 'C6' }).success).toBe(false);
  });
});

describe('aggregate_max', () => {
  const params = {
    maxAggregate: 24,
    components: [
      { subjectCodes: ['ENGLISH'], count: 1 },
      { subjectCodes: ['CORE_MATHS'], count: 1 },
      { subjectCodes: ['INTEGRATED_SCIENCE', 'SOCIAL_STUDIES'], count: 1 },
      { category: 'elective', count: 3 },
    ],
  };
  const results = {
    ENGLISH: 'B3',
    CORE_MATHS: 'C4',
    INTEGRATED_SCIENCE: 'C5',
    SOCIAL_STUDIES: 'B2',
    PHYSICS: 'B3',
    CHEMISTRY: 'C6',
    BIOLOGY: 'D7',
    ECONOMICS: 'A1',
  };

  it('sums the best grades per component', () => {
    const r = run('aggregate_max', params, results);
    // ENGLISH 3 + CORE_MATHS 4 + SOCIAL_STUDIES 2 + ECONOMICS 1, PHYSICS 3, CHEMISTRY 6 = 19
    expect(r.outcome).toBe('satisfied');
    expect(r.explanation).toMatchObject({ aggregate: 19, maxAggregate: 24 });
    if (r.explanation.type !== 'aggregate_max') throw new Error('wrong explanation');
    expect(r.explanation.counted.map((s) => s.subjectCode)).toEqual([
      'ENGLISH',
      'CORE_MATHS',
      'SOCIAL_STUDIES',
      'ECONOMICS',
      'PHYSICS',
      'CHEMISTRY',
    ]);
  });

  it('fails when the aggregate is above the maximum', () => {
    const r = run('aggregate_max', { ...params, maxAggregate: 18 }, results);
    expect(r).toMatchObject({ outcome: 'unsatisfied', reason: 'aggregate_too_high' });
    expect(r.explanation).toMatchObject({ aggregate: 19 });
  });

  it('cannot be calculated without enough subjects', () => {
    const r = run('aggregate_max', params, { ENGLISH: 'A1', CORE_MATHS: 'A1' });
    expect(r).toMatchObject({ outcome: 'unsatisfied', reason: 'not_enough_subjects' });
    expect(r.explanation).toMatchObject({ aggregate: null });
  });

  it('counts each subject in at most one component', () => {
    const r = run(
      'aggregate_max',
      {
        maxAggregate: 99,
        components: [
          { subjectCodes: ['PHYSICS', 'CHEMISTRY'], count: 1 },
          { subjectCodes: ['PHYSICS', 'CHEMISTRY'], count: 1 },
        ],
      },
      { PHYSICS: 'A1', CHEMISTRY: 'C6' },
    );
    expect(r.explanation).toMatchObject({ aggregate: 7 });
  });

  it('does not count towards subject sharing between sibling rules', () => {
    expect(run('aggregate_max', params, results).allocation).toBeUndefined();
  });
});

describe('manual_review', () => {
  it('always needs confirmation', () => {
    const r = run('manual_review', { description: 'Pass the entrance interview' }, {});
    expect(r).toMatchObject({
      outcome: 'needs_confirmation',
      explanation: { type: 'manual_review', description: 'Pass the entrance interview' },
    });
  });

  it('requires a non-blank description', () => {
    expect(getRuleType('manual_review')!.prepare({ description: '  ' }).success).toBe(false);
  });
});
