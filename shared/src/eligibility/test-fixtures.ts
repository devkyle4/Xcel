// Shared fixtures for eligibility engine tests.
import type {
  AcademicCatalogue,
  RequirementGroupNode,
  RequirementNode,
  RequirementRuleNode,
} from './types';

export const catalogue: AcademicCatalogue = {
  grades: ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'].map((code, i) => ({
    code,
    rank: i + 1,
    points: i + 1,
    isPass: code !== 'F9',
  })),
  subjects: [
    { code: 'ENGLISH', name: 'English Language', category: 'core' },
    { code: 'CORE_MATHS', name: 'Core Mathematics', category: 'core' },
    { code: 'INTEGRATED_SCIENCE', name: 'Integrated Science', category: 'core' },
    { code: 'SOCIAL_STUDIES', name: 'Social Studies', category: 'core' },
    { code: 'ELECTIVE_MATHS', name: 'Elective Mathematics', category: 'elective' },
    { code: 'PHYSICS', name: 'Physics', category: 'elective' },
    { code: 'CHEMISTRY', name: 'Chemistry', category: 'elective' },
    { code: 'BIOLOGY', name: 'Biology', category: 'elective' },
    { code: 'ECONOMICS', name: 'Economics', category: 'elective' },
    { code: 'GEOGRAPHY', name: 'Geography', category: 'elective' },
  ],
};

let nextId = 0;
const id = (prefix: string) => `${prefix}${++nextId}`;

export const rule = (ruleType: string, params: unknown, label?: string): RequirementRuleNode => ({
  kind: 'rule',
  id: id('r'),
  ruleType,
  params,
  label: label ?? null,
});

/** "minGrade or better in any one of subjectCodes". */
export const grade = (minGrade: string, ...subjectCodes: string[]) =>
  rule('subject_grade', { subjectCodes, minGrade });

export const manual = (description: string) => rule('manual_review', { description });

const group = (
  operator: RequirementGroupNode['operator'],
  children: RequirementNode[],
  minCount: number | null = null,
): RequirementGroupNode => ({ kind: 'group', id: id('g'), operator, minCount, children });

export const all = (...children: RequirementNode[]) => group('all', children);
export const any = (...children: RequirementNode[]) => group('any', children);
export const atLeast = (n: number, ...children: RequirementNode[]) =>
  group('at_least', children, n);

/** Typical WASSCE aggregate: English, Core Maths, best of Science/Social, best 3 electives. */
export const standardAggregate = (maxAggregate: number) =>
  rule('aggregate_max', {
    maxAggregate,
    components: [
      { subjectCodes: ['ENGLISH'], count: 1 },
      { subjectCodes: ['CORE_MATHS'], count: 1 },
      { subjectCodes: ['INTEGRATED_SCIENCE', 'SOCIAL_STUDIES'], count: 1 },
      { category: 'elective', count: 3 },
    ],
  });
