import { describe, expect, it } from 'vitest';
import { indexCatalogue } from './catalogue';
import { describeGroup, describeOutcome, describeRequirement, joinWords } from './describe';
import { evaluateEligibility } from './evaluate';
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
import type { RequirementGroupNode, RuleResult, StudentResults } from './types';

const index = indexCatalogue(catalogue);

/** Evaluates a single rule inside an AND group and returns its result. */
function single(node: RequirementGroupNode['children'][number], results: StudentResults) {
  return evaluateEligibility(all(node), results, catalogue).root!.children[0] as RuleResult;
}

const text = (node: RequirementGroupNode['children'][number], results: StudentResults) => {
  const r = single(node, results);
  return [describeRequirement(r, index), describeOutcome(r, index)];
};

describe('joinWords', () => {
  it.each([
    [[], ''],
    [['Physics'], 'Physics'],
    [['Physics', 'Chemistry'], 'Physics or Chemistry'],
    [['Physics', 'Chemistry', 'Biology'], 'Physics, Chemistry or Biology'],
  ])('%j -> %s', (words, expected) => {
    expect(joinWords(words, 'or')).toBe(expected);
  });
});

describe('subject_grade text', () => {
  it('describes a met requirement', () => {
    expect(text(grade('C6', 'PHYSICS'), { PHYSICS: 'B3' })).toEqual([
      'Physics: C6 or better',
      'You have B3 in Physics.',
    ]);
  });

  it('compares the student grade with the threshold', () => {
    expect(text(grade('C6', 'CHEMISTRY', 'BIOLOGY'), { CHEMISTRY: 'D7', BIOLOGY: 'E8' })).toEqual([
      'Chemistry or Biology: C6 or better',
      'You have D7 in Chemistry and E8 in Biology; C6 or better is required.',
    ]);
  });

  it('names alternatives that were not entered', () => {
    expect(text(grade('C6', 'CHEMISTRY', 'BIOLOGY'), {})[1]).toBe(
      'You have not entered Chemistry or Biology.',
    );
  });
});

describe('subject_count text', () => {
  const threeElectives = rule('subject_count', { count: 3, minGrade: 'C6', category: 'elective' });

  it('lists counted subjects', () => {
    expect(text(threeElectives, { PHYSICS: 'A1', CHEMISTRY: 'B2', BIOLOGY: 'C6' })).toEqual([
      'Any 3 elective subjects: C6 or better',
      'Counted: Physics (A1), Chemistry (B2) and Biology (C6).',
    ]);
  });

  it('explains a shortfall', () => {
    expect(text(threeElectives, { PHYSICS: 'A1', CHEMISTRY: 'D7' })[1]).toBe(
      'You have 1 qualifying subject (Physics (A1)); 3 are required at C6 or better.',
    );
  });

  it('describes listed pools and exclusions', () => {
    const r = single(
      rule('subject_count', {
        count: 2,
        minGrade: 'C6',
        subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'],
        excludeSubjectCodes: ['BIOLOGY'],
      }),
      {},
    );
    expect(describeRequirement(r, index)).toBe(
      'Any 2 of Physics, Chemistry and Biology (not counting Biology): C6 or better',
    );
    expect(describeOutcome(r, index)).toBe(
      'You have no qualifying subjects; 2 are required at C6 or better.',
    );
  });
});

describe('aggregate_max text', () => {
  it('describes the calculation and the result', () => {
    const results = {
      ENGLISH: 'C6',
      CORE_MATHS: 'C6',
      SOCIAL_STUDIES: 'C6',
      PHYSICS: 'C6',
      CHEMISTRY: 'C6',
      BIOLOGY: 'C6',
    };
    expect(text(standardAggregate(24), results)).toEqual([
      'Aggregate of 24 or better (lower is better). Counting English Language, Core Mathematics, best of Integrated Science or Social Studies, best 3 elective subjects',
      'Your aggregate is 36; 24 or better is required.',
    ]);
  });

  it('explains when it cannot be calculated', () => {
    expect(text(standardAggregate(24), { ENGLISH: 'A1' })[1]).toBe(
      'You have not entered enough subjects to calculate this aggregate.',
    );
  });
});

describe('other outcomes', () => {
  it('asks the student to confirm manual requirements', () => {
    expect(text(manual('Pass the entrance interview'), {})).toEqual([
      'Pass the entrance interview',
      'This cannot be checked from your results. Confirm it with the institution.',
    ]);
  });

  it('explains requirements that could not be checked', () => {
    expect(text(rule('portfolio_score', {}), {})[1]).toMatch(/could not be checked automatically/);
  });

  it('explains subjects already counted elsewhere', () => {
    const result = evaluateEligibility(
      all(grade('C6', 'PHYSICS'), grade('C6', 'PHYSICS')),
      { PHYSICS: 'A1' },
      catalogue,
    );
    expect(describeOutcome(result.causes[0] as RuleResult, index)).toMatch(/already counted/);
  });
});

describe('describeGroup', () => {
  it.each([
    [all(grade('C6', 'PHYSICS')), 'All of the following'],
    [any(grade('C6', 'PHYSICS')), 'Any one of the following'],
    [atLeast(2, grade('C6', 'PHYSICS'), grade('C6', 'BIOLOGY')), 'Any 2 of the following'],
  ])('%#', (group, heading) => {
    expect(describeGroup(evaluateEligibility(group, {}, catalogue).root!)).toBe(heading);
  });
});

describe('aggregate cut-off text', () => {
  const cutoff = rule('aggregate_max', {
    maxAggregate: 10,
    basis: 'cutoff',
    gradePoints: { C4: 4, C5: 4, C6: 4 },
    components: [
      { subjectCodes: ['ENGLISH'], count: 1 },
      { subjectCodes: ['CORE_MATHS'], count: 1 },
      { category: 'elective', count: 1 },
    ],
  });

  it('says the cut-off can change and lists only points that differ', () => {
    const [requirement, outcome] = text(cutoff, { ENGLISH: 'C6', CORE_MATHS: 'C5', PHYSICS: 'B3' });
    expect(requirement).toBe(
      'Aggregate of 10 or better (lower is better), the latest published cut-off, which can change each year. Counting English Language, Core Mathematics, best elective subject; C5 and C6 count as 4',
    );
    expect(outcome).toBe('Your aggregate is 11; the latest published cut-off is 10.');
  });
});
