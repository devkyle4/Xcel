import type { AcademicCatalogue, RequirementGroupNode } from '@xcel/shared';
import { diffLines, requirementLines } from './diff';

const catalogue: AcademicCatalogue = {
  subjects: [
    { code: 'ENGLISH', name: 'English Language', category: 'core' },
    { code: 'PHYSICS', name: 'Physics', category: 'elective' },
  ],
  grades: [
    { code: 'B3', rank: 3, points: 3, isPass: true },
    { code: 'C6', rank: 6, points: 6, isPass: true },
  ],
};

const tree = (minGrade: string): RequirementGroupNode => ({
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
      kind: 'rule',
      id: 'b',
      ruleType: 'subject_grade',
      params: { subjectCodes: ['PHYSICS'], minGrade },
    },
  ],
});

describe('requirement version diff', () => {
  it('describes a tree as indented plain-language lines', () => {
    expect(requirementLines(tree('C6'), catalogue)).toEqual([
      'All of the following',
      '  English Language: C6 or better',
      '  Physics: C6 or better',
    ]);
    expect(requirementLines(null, catalogue)).toEqual([]);
  });

  it('lists what was removed and added', () => {
    const changes = diffLines(
      requirementLines(tree('C6'), catalogue),
      requirementLines(tree('B3'), catalogue),
    );
    expect(changes).toEqual([
      { kind: 'removed', line: '  Physics: C6 or better' },
      { kind: 'added', line: '  Physics: B3 or better' },
    ]);
    expect(diffLines(['a', 'a'], ['a'])).toEqual([{ kind: 'removed', line: 'a' }]);
    expect(diffLines(['a'], ['a'])).toEqual([]);
  });
});
