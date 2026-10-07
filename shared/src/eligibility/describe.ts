import type { SubjectCategory } from '../domain';
import type { CatalogueIndex } from './catalogue';
import type { AggregateComponentResult, GroupResult, RuleResult, SubjectGrade } from './types';

/**
 * Plain-language text for eligibility results, generated only from the
 * structured rules and results (never from stored free text).
 */

/** "Physics", "Physics or Chemistry", "Physics, Chemistry or Biology". */
export function joinWords(words: readonly string[], conjunction: 'or' | 'and'): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`;
}

const plural = (n: number, singular: string, pluralForm = `${singular}s`) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

const categoryNoun = (category: SubjectCategory | null, n: number) =>
  `${category ? `${category} ` : ''}${n === 1 ? 'subject' : 'subjects'}`;

function names(codes: readonly string[], catalogue: CatalogueIndex): string[] {
  return codes.map((code) => catalogue.subjectName(code));
}

function gradeList(grades: readonly SubjectGrade[], catalogue: CatalogueIndex): string {
  return joinWords(
    grades.map((g) => `${catalogue.subjectName(g.subjectCode)} (${g.gradeCode})`),
    'and',
  );
}

function describeComponent(c: AggregateComponentResult, catalogue: CatalogueIndex): string {
  if (c.subjectCodes) {
    const list = names(c.subjectCodes, catalogue);
    return c.subjectCodes.length === c.count
      ? joinWords(list, 'and')
      : `best ${c.count === 1 ? '' : `${c.count} `}of ${joinWords(list, 'or')}`;
  }
  return c.count === 1
    ? `best ${categoryNoun(c.category, 1)}`
    : `best ${c.count} ${categoryNoun(c.category, c.count)}`;
}

/** What the requirement asks for, e.g. "Chemistry or Biology: C6 or better". */
export function describeRequirement(rule: RuleResult, catalogue: CatalogueIndex): string {
  const e = rule.explanation;
  switch (e.type) {
    case 'subject_grade':
      return `${joinWords(names(e.acceptedSubjects, catalogue), 'or')}: ${e.minGrade} or better`;
    case 'subject_count': {
      const pool = e.acceptedSubjects
        ? `Any ${e.count} of ${joinWords(names(e.acceptedSubjects, catalogue), 'and')}`
        : `Any ${e.count} ${categoryNoun(e.category, e.count)}`;
      const excluded = e.excludedSubjects.length
        ? ` (not counting ${joinWords(names(e.excludedSubjects, catalogue), 'or')})`
        : '';
      return `${pool}${excluded}: ${e.minGrade} or better`;
    }
    case 'aggregate_max':
      return `Aggregate of ${e.maxAggregate} or better (lower is better), counting ${e.components
        .map((c) => describeComponent(c, catalogue))
        .join(', ')}`;
    case 'manual_review':
      return e.description;
    case 'invalid':
      return 'A requirement that could not be read';
  }
}

/** How the student's results compare, e.g. "You have D7 in Physics; C6 or better is required." */
export function describeOutcome(rule: RuleResult, catalogue: CatalogueIndex): string {
  const e = rule.explanation;

  if (rule.outcome === 'needs_confirmation') {
    return 'This cannot be checked from your results. Confirm it with the institution.';
  }
  if (rule.outcome === 'unevaluable' || e.type === 'invalid' || e.type === 'manual_review') {
    return 'This requirement could not be checked automatically. Check the official requirements.';
  }
  if (rule.reason === 'subjects_already_counted') {
    return 'Your qualifying subjects are already counted towards other requirements, and each subject can only count once.';
  }

  switch (e.type) {
    case 'subject_grade': {
      if (rule.outcome === 'satisfied') {
        const code = rule.countedSubjects[0]!;
        const grade = e.studentGrades.find((g) => g.subjectCode === code)?.gradeCode;
        return `You have ${grade} in ${catalogue.subjectName(code)}.`;
      }
      if (rule.reason === 'not_taken') {
        return `You have not entered ${joinWords(names(e.acceptedSubjects, catalogue), 'or')}.`;
      }
      const taken = e.studentGrades.flatMap((g) =>
        g.gradeCode ? [`${g.gradeCode} in ${catalogue.subjectName(g.subjectCode)}`] : [],
      );
      return `You have ${joinWords(taken, 'and')}; ${e.minGrade} or better is required.`;
    }
    case 'subject_count': {
      if (rule.outcome === 'satisfied') {
        const counted = e.qualifying.filter((q) => rule.countedSubjects.includes(q.subjectCode));
        return `Counted: ${gradeList(counted, catalogue)}.`;
      }
      const have = e.qualifying.length
        ? `You have ${plural(e.qualifying.length, 'qualifying subject')} (${gradeList(e.qualifying, catalogue)})`
        : 'You have no qualifying subjects';
      return `${have}; ${e.count} ${e.count === 1 ? 'is' : 'are'} required at ${e.minGrade} or better.`;
    }
    case 'aggregate_max':
      if (e.aggregate === null) {
        return 'You have not entered enough subjects to calculate this aggregate.';
      }
      return rule.outcome === 'satisfied'
        ? `Your aggregate is ${e.aggregate}.`
        : `Your aggregate is ${e.aggregate}; ${e.maxAggregate} or better is required.`;
  }
}

/** Heading for a group of requirements. */
export function describeGroup(group: GroupResult): string {
  switch (group.operator) {
    case 'all':
      return 'All of the following';
    case 'any':
      return 'Any one of the following';
    case 'at_least':
      return `Any ${group.required} of the following`;
  }
}
