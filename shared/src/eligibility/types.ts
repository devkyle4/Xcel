import type { RequirementOperator, SubjectCategory } from '../domain';

export const ELIGIBILITY_STATUSES = [
  'Eligible',
  'LikelyEligible',
  'NotEligible',
  'NeedsReview',
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

/**
 * Outcome of a single requirement node.
 * - satisfied: met, from the student's results alone
 * - unsatisfied: definitely not met
 * - needs_confirmation: may be met, but a person must confirm (drives LikelyEligible)
 * - unevaluable: the requirement cannot be safely evaluated (drives NeedsReview)
 */
export type NodeOutcome = 'satisfied' | 'unsatisfied' | 'needs_confirmation' | 'unevaluable';

// ---------- Inputs ----------

export interface CatalogueGrade {
  code: string;
  /** 1 is the best grade. */
  rank: number;
  /** Value used in aggregate calculations; null if the grade has none. */
  points: number | null;
  isPass: boolean;
}

export interface CatalogueSubject {
  code: string;
  name: string;
  category: SubjectCategory;
}

/** Grade ordering and subjects as configured by the administrator. */
export interface AcademicCatalogue {
  grades: readonly CatalogueGrade[];
  subjects: readonly CatalogueSubject[];
}

/** A student's WASSCE results: subject code -> grade code. */
export type StudentResults = Readonly<Record<string, string>>;

export interface RequirementRuleNode {
  kind: 'rule';
  id: string;
  ruleType: string;
  params: unknown;
  label?: string | null;
}

export interface RequirementGroupNode {
  kind: 'group';
  id: string;
  operator: RequirementOperator;
  /** Required for `at_least` ("any N of"). */
  minCount?: number | null;
  label?: string | null;
  children: readonly RequirementNode[];
}

export type RequirementNode = RequirementRuleNode | RequirementGroupNode;

// ---------- Outputs ----------

export interface SubjectGrade {
  subjectCode: string;
  gradeCode: string;
}

export interface SubjectPoints extends SubjectGrade {
  points: number;
}

export type RuleExplanation =
  | {
      type: 'subject_grade';
      minGrade: string;
      /** Any one of these subjects satisfies the rule (alternatives / equivalents). */
      acceptedSubjects: string[];
      /** The student's grade in each accepted subject, or null if not entered. */
      studentGrades: { subjectCode: string; gradeCode: string | null }[];
    }
  | {
      type: 'subject_count';
      minGrade: string;
      count: number;
      /** Listed subjects, or null when the pool is a category or any subject. */
      acceptedSubjects: string[] | null;
      category: SubjectCategory | null;
      excludedSubjects: string[];
      /** Student subjects in the pool at or above the minimum grade, best first. */
      qualifying: SubjectGrade[];
    }
  | {
      type: 'aggregate_max';
      maxAggregate: number;
      /** 'cutoff': the maximum is an institution's published cut-off, which can change each year. */
      basis: 'requirement' | 'cutoff';
      /** Grade points that differ from the catalogue for this institution. */
      gradePoints: Record<string, number>;
      /** Null when the student has not entered enough subjects to calculate it. */
      aggregate: number | null;
      counted: SubjectPoints[];
      components: AggregateComponentResult[];
    }
  | { type: 'manual_review'; description: string }
  | {
      type: 'invalid';
      problem: 'unknown_rule_type' | 'invalid_params' | 'unknown_codes';
      detail: string;
    };

export interface AggregateComponentResult {
  subjectCodes: string[] | null;
  category: SubjectCategory | null;
  count: number;
  counted: SubjectPoints[];
}

export type RuleFailureReason =
  | 'not_taken'
  | 'grade_too_low'
  | 'not_enough_subjects'
  | 'aggregate_too_high'
  | 'subjects_already_counted';

export interface RuleResult {
  kind: 'rule';
  id: string;
  ruleType: string;
  label: string | null;
  outcome: NodeOutcome;
  reason: RuleFailureReason | null;
  explanation: RuleExplanation;
  /** Subjects this rule counted, after sharing subjects out between sibling rules. */
  countedSubjects: string[];
}

export type GroupProblem = 'empty_group' | 'invalid_min_count' | 'too_complex';

export interface GroupResult {
  kind: 'group';
  id: string;
  operator: RequirementOperator;
  minCount: number | null;
  label: string | null;
  outcome: NodeOutcome;
  /** Number of children that must be satisfied. */
  required: number;
  satisfiedCount: number;
  /** Set when the group itself is misconfigured. */
  problem: GroupProblem | null;
  children: NodeResult[];
}

export type NodeResult = RuleResult | GroupResult;

export interface EligibilityResult {
  status: EligibilityStatus;
  /** Null when the admission cycle has no requirements configured. */
  root: GroupResult | null;
  /**
   * The nodes that determine the status: failing requirements for NotEligible,
   * requirements to confirm for LikelyEligible, unevaluable ones for NeedsReview.
   * Empty for Eligible.
   */
  causes: NodeResult[];
}
